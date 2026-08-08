from typing import Literal
from pydantic import BaseModel, Field


Verdict = Literal["allow", "redact", "approval", "block"]


class SecurityAssessment(BaseModel):
    verdict: Verdict = Field(description="The strongest safe policy outcome")
    risk_score: int = Field(ge=0, le=100)
    explanation: str = Field(min_length=8, max_length=800)
    signals: list[str] = Field(default_factory=list, max_length=8)
    recommended_policy: str = Field(description="The AgentGuard policy ID or DEFAULT-DENY")


class RunnerRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=10_000)
    trace_id: str | None = None


class RunnerResponse(BaseModel):
    runtime: Literal["langgraph", "pydantic-ai"]
    output: str
    trace_id: str
    assessment: SecurityAssessment
    graph_steps: list[str] = Field(default_factory=list)


class IngestRequest(BaseModel):
    documents: list[str] = Field(min_length=1, max_length=50)
    source: str = "portfolio-demo"


class OptimizeRequest(BaseModel):
    max_examples: int = Field(default=4, ge=4, le=24)

