from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Literal, TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph

from .pydantic_runtime import assess_with_pydantic
from .retrieval import retrieve_controls
from .schemas import SecurityAssessment
from .settings import get_settings


class GuardState(TypedDict, total=False):
    prompt: str
    retrieved_context: list[str]
    assessment: dict[str, Any]
    output: str
    steps: list[str]


async def retrieve_node(state: GuardState) -> GuardState:
    context = await retrieve_controls(state["prompt"])
    return {"retrieved_context": context, "steps": [*state.get("steps", []), "llamaindex.retrieve"]}


async def assess_node(state: GuardState) -> GuardState:
    assessment = await assess_with_pydantic(state["prompt"], state.get("retrieved_context"))
    return {"assessment": assessment.model_dump(), "steps": [*state.get("steps", []), "pydantic-ai.assess"]}


def route_decision(state: GuardState) -> Literal["human_checkpoint", "finalize"]:
    verdict = state["assessment"]["verdict"]
    return "human_checkpoint" if verdict == "approval" else "finalize"


def human_checkpoint_node(state: GuardState) -> GuardState:
    assessment = SecurityAssessment.model_validate(state["assessment"])
    output = f"PENDING HUMAN APPROVAL — {assessment.explanation}"
    return {"output": output, "steps": [*state.get("steps", []), "langgraph.human-checkpoint"]}


def finalize_node(state: GuardState) -> GuardState:
    assessment = SecurityAssessment.model_validate(state["assessment"])
    output = f"{assessment.verdict.upper()} — {assessment.explanation}"
    return {"output": output, "steps": [*state.get("steps", []), "langgraph.finalize"]}


def build_graph(checkpointer: Any):
    builder = StateGraph(GuardState)
    builder.add_node("retrieve", retrieve_node)
    builder.add_node("assess", assess_node)
    builder.add_node("human_checkpoint", human_checkpoint_node)
    builder.add_node("finalize", finalize_node)
    builder.add_edge(START, "retrieve")
    builder.add_edge("retrieve", "assess")
    builder.add_conditional_edges("assess", route_decision)
    builder.add_edge("human_checkpoint", END)
    builder.add_edge("finalize", END)
    return builder.compile(checkpointer=checkpointer)


@asynccontextmanager
async def hosted_checkpointer() -> AsyncIterator[Any]:
    database_url = get_settings().database_url
    if not database_url:
        yield InMemorySaver()
        return

    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

    async with AsyncPostgresSaver.from_conn_string(database_url) as saver:
        yield saver


async def run_graph(prompt: str, trace_id: str) -> GuardState:
    async with hosted_checkpointer() as checkpointer:
        graph = build_graph(checkpointer)
        return await graph.ainvoke(
            {"prompt": prompt, "steps": ["langgraph.start"]},
            {"configurable": {"thread_id": trace_id}},
        )

