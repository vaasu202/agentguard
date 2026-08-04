from contextlib import asynccontextmanager
from secrets import compare_digest
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException

from .dspy_optimizer import optimize_classifier
from .langgraph_runtime import run_graph
from .pydantic_runtime import assess_with_pydantic
from .retrieval import ingest_documents, retrieve_controls
from .schemas import IngestRequest, OptimizeRequest, RunnerRequest, RunnerResponse
from .settings import get_settings
from .telemetry import configure_telemetry, tracer


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_telemetry()
    yield


app = FastAPI(title="AgentGuard Intelligence", version="0.1.0", lifespan=lifespan)


def authorize(authorization: str = Header(default="")) -> None:
    expected = get_settings().service_api_key
    if not expected:
        raise HTTPException(status_code=503, detail="SERVICE_API_KEY is not configured")
    supplied = authorization.removeprefix("Bearer ").strip()
    if not compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Invalid service credential")


@app.get("/health")
async def health() -> dict[str, object]:
    settings = get_settings()
    return {
        "ok": True,
        "hosted_only": True,
        "model": settings.openai_default_model,
        "integrations": {
            "openai": bool(settings.openai_api_key),
            "postgres": bool(settings.database_url),
            "qdrant": bool(settings.qdrant_url and settings.qdrant_api_key),
            "litellm": bool(settings.litellm_base_url and settings.litellm_api_key),
            "phoenix": bool(settings.phoenix_collector_endpoint and settings.phoenix_api_key),
        },
    }


@app.post("/v1/runners/pydantic-ai", response_model=RunnerResponse, dependencies=[Depends(authorize)])
async def pydantic_runner(request: RunnerRequest) -> RunnerResponse:
    trace_id = request.trace_id or f"trace_{uuid4()}"
    with tracer.start_as_current_span("pydantic-ai.security-assessment") as span:
        span.set_attribute("agentguard.trace_id", trace_id)
        context = await retrieve_controls(request.prompt)
        assessment = await assess_with_pydantic(request.prompt, context)
    return RunnerResponse(
        runtime="pydantic-ai",
        output=f"{assessment.verdict.upper()} — {assessment.explanation}",
        trace_id=trace_id,
        assessment=assessment,
        graph_steps=["llamaindex.retrieve", "pydantic-ai.structured-output"],
    )


@app.post("/v1/runners/langgraph", response_model=RunnerResponse, dependencies=[Depends(authorize)])
async def langgraph_runner(request: RunnerRequest) -> RunnerResponse:
    trace_id = request.trace_id or f"trace_{uuid4()}"
    with tracer.start_as_current_span("langgraph.guard-workflow") as span:
        span.set_attribute("agentguard.trace_id", trace_id)
        state = await run_graph(request.prompt, trace_id)
    return RunnerResponse(
        runtime="langgraph",
        output=state["output"],
        trace_id=trace_id,
        assessment=state["assessment"],
        graph_steps=state.get("steps", []),
    )


@app.post("/v1/knowledge/ingest", dependencies=[Depends(authorize)])
async def ingest(request: IngestRequest) -> dict[str, object]:
    count = ingest_documents(request.documents, request.source)
    return {"ingested": count, "destination": "hosted-qdrant", "source": request.source}


@app.post("/v1/optimize/dspy", dependencies=[Depends(authorize)])
async def optimize(request: OptimizeRequest) -> dict[str, object]:
    return optimize_classifier(request.max_examples)

