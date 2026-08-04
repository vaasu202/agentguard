import { z } from "zod";

export const VerdictSchema = z.enum(["allow", "redact", "approval", "block"]);
export type Verdict = z.infer<typeof VerdictSchema>;

export const GuardRequestSchema = z.object({
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  timestamp: z.string().datetime(),
  principal: z.object({
    agentId: z.string().min(1),
    runtime: z.enum(["openai-agents", "langgraph", "mastra", "pydantic-ai"]),
    roles: z.array(z.string()).min(1),
  }),
  tool: z.object({
    server: z.string().min(1),
    name: z.string().min(1),
    risk: z.enum(["read", "write", "destructive"]),
  }),
  arguments: z.record(z.string(), z.unknown()),
  environment: z.enum(["development", "staging", "production"]),
  provenance: z.object({
    source: z.enum(["system", "user", "retrieved-content"]),
    trusted: z.boolean(),
    summary: z.string(),
  }),
});

export type GuardRequest = z.infer<typeof GuardRequestSchema>;

export const GuardDecisionSchema = z.object({
  decisionId: z.string(),
  requestId: z.string(),
  verdict: VerdictSchema,
  riskScore: z.number().min(0).max(100),
  matchedPolicies: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      effect: VerdictSchema,
      priority: z.number(),
    }),
  ),
  signals: z.array(z.string()),
  explanation: z.string(),
  sanitizedArguments: z.record(z.string(), z.unknown()),
  approvalRequestId: z.string().optional(),
  evaluationMs: z.number(),
});

export type GuardDecision = z.infer<typeof GuardDecisionSchema>;

export type PolicyEffect = Verdict;

export interface PolicyDefinition {
  id: string;
  name: string;
  description: string;
  effect: PolicyEffect;
  priority: number;
  enabled: boolean;
  category: "injection" | "secrets" | "environment" | "authorization" | "financial";
}

export const RuntimeSchema = z.enum(["openai-agents", "langgraph", "mastra", "pydantic-ai"]);
export type AgentRuntime = z.infer<typeof RuntimeSchema>;

export type SimulationEventType =
  | "run.started"
  | "agent.context"
  | "agent.intent"
  | "tool.requested"
  | "guard.validating"
  | "guard.signal"
  | "guard.decision"
  | "approval.pending"
  | "tool.executed"
  | "tool.blocked"
  | "audit.committed"
  | "run.completed";

export interface SimulationEvent {
  id: string;
  traceId: string;
  sequence: number;
  type: SimulationEventType;
  timestamp: string;
  title: string;
  detail: string;
  tone: "neutral" | "info" | "safe" | "warning" | "danger";
  payload?: Record<string, unknown>;
}

export interface AttackScenario {
  id: string;
  index: string;
  label: string;
  title: string;
  summary: string;
  source: string;
  command: string;
  expectedVerdict: Verdict;
  policyFocus: string;
  request: Omit<GuardRequest, "requestId" | "sessionId" | "timestamp" | "principal">;
}
