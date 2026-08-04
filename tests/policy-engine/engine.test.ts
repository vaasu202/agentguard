import { describe, expect, it } from "vitest";
import { evaluateGuardRequest, redactSecrets } from "@/lib/guard/engine";
import { ATTACK_SCENARIOS } from "@/lib/guard/scenarios";
import type { AgentRuntime, GuardRequest } from "@/lib/guard/types";

function requestFor(scenarioId: string, runtime: AgentRuntime = "openai-agents"): GuardRequest {
  const scenario = ATTACK_SCENARIOS.find((item) => item.id === scenarioId);
  if (!scenario) throw new Error(`Missing scenario ${scenarioId}`);
  return {
    ...scenario.request,
    requestId: `req_${scenarioId}`,
    sessionId: "test_session",
    timestamp: new Date().toISOString(),
    principal: { agentId: "test-agent", runtime, roles: ["security-operator"] },
  };
}

describe("AgentGuard policy engine", () => {
  it.each(ATTACK_SCENARIOS)("returns $expectedVerdict for $title", (scenario) => {
    expect(evaluateGuardRequest(requestFor(scenario.id)).verdict).toBe(scenario.expectedVerdict);
  });

  it("gives blocking policies precedence over approvals", () => {
    const decision = evaluateGuardRequest(requestFor("indirect-injection"));
    expect(decision.verdict).toBe("block");
    expect(decision.matchedPolicies.map((item) => item.id)).toContain("AG-103");
    expect(decision.matchedPolicies.map((item) => item.id)).toContain("AG-101");
  });

  it("redacts nested credentials without mutating unrelated fields", () => {
    const result = redactSecrets({
      message: "token=sk-demo-THIS_IS_NOT_A_REAL_KEY-7J4K92",
      nested: { channel: "security" },
    });
    expect(result).toEqual({
      message: "token=[REDACTED BY AGENTGUARD]",
      nested: { channel: "security" },
    });
  });

  it("defaults to deny for an unknown write tool", () => {
    const input = requestFor("safe-repository-read");
    input.tool = { server: "unknown", name: "unknown.admin", risk: "destructive" };
    const decision = evaluateGuardRequest(input);
    expect(decision.verdict).toBe("block");
    expect(decision.signals).toContain("No policy explicitly authorizes this tool request");
  });

  it("produces the same security verdict across every agent runtime", () => {
    const runtimes: AgentRuntime[] = ["openai-agents", "langgraph", "mastra", "pydantic-ai"];
    expect(runtimes.map((runtime) => evaluateGuardRequest(requestFor("secret-exfiltration", runtime)).verdict)).toEqual([
      "redact",
      "redact",
      "redact",
      "redact",
    ]);
  });
});
