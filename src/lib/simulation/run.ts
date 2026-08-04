import { randomUUID } from "node:crypto";
import { appendAudit } from "@/lib/guard/audit";
import { persistSecurityRun } from "@/lib/data/postgres";
import { evaluateGuardRequest } from "@/lib/guard/engine";
import { getScenario } from "@/lib/guard/scenarios";
import type { AgentRuntime, GuardRequest, SimulationEvent } from "@/lib/guard/types";

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

interface SimulationOptions {
  scenarioId: string;
  runtime: AgentRuntime;
  pace?: number;
  onEvent: (event: SimulationEvent) => void;
}

export async function runSimulation({ scenarioId, runtime, pace = 1, onEvent }: SimulationOptions) {
  const scenario = getScenario(scenarioId);
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);

  const traceId = `trace_${randomUUID()}`;
  const request: GuardRequest = {
    ...scenario.request,
    requestId: `req_${randomUUID()}`,
    sessionId: `session_${randomUUID()}`,
    timestamp: new Date().toISOString(),
    principal: {
      agentId: `${runtime}-security-worker`,
      runtime,
      roles: ["security-operator", "mcp-client"],
    },
  };

  let sequence = 0;
  const emit = async (
    type: SimulationEvent["type"],
    title: string,
    detail: string,
    tone: SimulationEvent["tone"],
    payload?: Record<string, unknown>,
    wait = 300,
  ) => {
    onEvent({
      id: `stream_${randomUUID()}`,
      traceId,
      sequence: sequence++,
      type,
      timestamp: new Date().toISOString(),
      title,
      detail,
      tone,
      payload,
    });
    await sleep(Math.max(40, wait * pace));
  };

  await emit("run.started", "Agent run opened", `${runtime} accepted scenario ${scenario.index}`, "info", {
    runtime,
    scenarioId,
  });
  await emit("agent.context", "Context attached", scenario.source, "neutral", { provenance: request.provenance });
  await emit("agent.intent", "Agent formed an action", scenario.command, "warning", undefined, 380);
  await emit(
    "tool.requested",
    "MCP tool call emitted",
    `${request.tool.server} / ${request.tool.name}`,
    request.tool.risk === "read" ? "info" : "warning",
    { request },
    420,
  );
  await emit("guard.validating", "Policy boundary engaged", "Validating schema, provenance, scope, and arguments", "info");

  const decision = evaluateGuardRequest(request);
  for (const signal of decision.signals.slice(0, 2)) {
    await emit("guard.signal", "Risk signal detected", signal, decision.verdict === "block" ? "danger" : "warning", undefined, 260);
  }

  await emit(
    "guard.decision",
    `${decision.verdict.toUpperCase()} enforced`,
    decision.explanation,
    decision.verdict === "allow" ? "safe" : decision.verdict === "block" ? "danger" : "warning",
    { decision },
    460,
  );

  if (decision.verdict === "approval") {
    await emit(
      "approval.pending",
      "Human decision required",
      "Execution is suspended at the policy boundary until an operator decides.",
      "warning",
      { approvalRequestId: decision.approvalRequestId },
      260,
    );
  } else if (decision.verdict === "block") {
    await emit("tool.blocked", "Executor isolated", "The protected MCP executor was never invoked.", "danger", undefined, 260);
  } else {
    await emit(
      "tool.executed",
      decision.verdict === "redact" ? "Sanitized call released" : "Tool call released",
      decision.verdict === "redact" ? "Only redacted arguments crossed the boundary." : "Authorized read completed.",
      "safe",
      { arguments: decision.sanitizedArguments },
      260,
    );
  }

  const audit = appendAudit(traceId, request, decision);
  if (process.env.DATABASE_URL) {
    await persistSecurityRun({
      traceId,
      runtime,
      scenarioId,
      verdict: decision.verdict,
      riskScore: decision.riskScore,
      payload: { request, decision, audit },
    });
  }
  await emit("audit.committed", "Audit chain extended", `SHA-256 ${audit.hash.slice(0, 16)}…`, "neutral", { audit }, 220);
  await emit(
    "run.completed",
    "Security run complete",
    `Expected ${scenario.expectedVerdict.toUpperCase()} · received ${decision.verdict.toUpperCase()}`,
    decision.verdict === scenario.expectedVerdict ? "safe" : "danger",
    { decision, audit, request, expectedVerdict: scenario.expectedVerdict },
    40,
  );

  return { traceId, request, decision, audit };
}
