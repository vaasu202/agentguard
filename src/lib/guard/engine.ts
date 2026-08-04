import { randomUUID } from "node:crypto";
import { DEFAULT_POLICIES, VERDICT_WEIGHT } from "./policies";
import {
  GuardRequestSchema,
  type GuardDecision,
  type GuardRequest,
  type PolicyDefinition,
  type Verdict,
} from "./types";

const NAMED_SECRET_PATTERN = /(?:api[_-]?key|password|secret|token)(\s*[:=]\s*["']?)[^\s,"'}]{8,}/gi;

const SECRET_PATTERNS = [
  NAMED_SECRET_PATTERN,
  /sk-[A-Za-z0-9_-]{12,}/gi,
  /ghp_[A-Za-z0-9]{12,}/gi,
  /xox[baprs]-[A-Za-z0-9-]{10,}/gi,
  /Bearer\s+[A-Za-z0-9._~+/-]{12,}/gi,
];

const INJECTION_PATTERNS = [
  /ignore (?:all |any )?(?:previous|prior|system) instructions/i,
  /override (?:the )?(?:system|developer|security) (?:message|policy|rules)/i,
  /exfiltrat(?:e|ion)|steal (?:the )?(?:secret|credential|token)/i,
  /do not tell (?:the )?(?:user|operator|security)/i,
  /call (?:the )?(?:admin|database|deployment) tool/i,
];

const DESTRUCTIVE_SQL = /\b(drop|truncate|alter\s+role|delete\s+from|grant\s+all|revoke)\b/i;

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function hasSecret(value: unknown): boolean {
  const text = stringify(value);
  return SECRET_PATTERNS.some((pattern) => new RegExp(pattern.source, pattern.flags).test(text));
}

function hasInjection(value: unknown): boolean {
  const text = stringify(value);
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

function redactString(value: string): string {
  const namedSecretRedacted = value.replace(
    new RegExp(NAMED_SECRET_PATTERN.source, NAMED_SECRET_PATTERN.flags),
    (match, separator: string) => `${match.slice(0, match.indexOf(separator))}${separator}[REDACTED BY AGENTGUARD]`,
  );
  return SECRET_PATTERNS.slice(1).reduce(
    (current, pattern) => current.replace(new RegExp(pattern.source, pattern.flags), "[REDACTED BY AGENTGUARD]"),
    namedSecretRedacted,
  );
}

export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redactSecrets(child)]));
  }
  return value;
}

function findAmount(value: Record<string, unknown>): number | undefined {
  const candidate = value.amount ?? value.amountUsd ?? value.refundAmount;
  return typeof candidate === "number" ? candidate : undefined;
}

function policy(id: string): PolicyDefinition {
  const match = DEFAULT_POLICIES.find((item) => item.id === id);
  if (!match) throw new Error(`Unknown policy ${id}`);
  return match;
}

export function evaluateGuardRequest(input: GuardRequest): GuardDecision {
  const started = performance.now();
  const request = GuardRequestSchema.parse(input);
  const matches: PolicyDefinition[] = [];
  const signals: string[] = [];
  const argumentText = stringify(request.arguments);

  const injection = hasInjection(request.arguments) || hasInjection(request.provenance.summary);
  if (injection && (!request.provenance.trusted || request.provenance.source === "retrieved-content")) {
    matches.push(policy("AG-101"));
    signals.push("Untrusted retrieved content contains instruction-override language");
  }

  if (request.tool.name === "database.execute" && DESTRUCTIVE_SQL.test(argumentText)) {
    matches.push(policy("AG-102"));
    signals.push("Destructive SQL verb detected in database execution request");
  }

  if (request.environment === "production" && request.tool.risk !== "read") {
    matches.push(policy("AG-103"));
    signals.push("State-changing action targets the production environment");
  }

  const amount = findAmount(request.arguments);
  if (typeof amount === "number" && amount >= 500) {
    matches.push(policy("AG-104"));
    signals.push(`Financial amount ${amount.toFixed(2)} exceeds the autonomous limit`);
  }

  if (hasSecret(request.arguments)) {
    matches.push(policy("AG-105"));
    signals.push("Credential-shaped value detected in outbound tool arguments");
  }

  if (request.tool.risk === "read") matches.push(policy("AG-106"));
  if (request.tool.risk === "write" && request.environment !== "production") matches.push(policy("AG-107"));

  const activeMatches = matches.filter((item) => item.enabled).sort((a, b) => b.priority - a.priority);
  const verdict: Verdict = activeMatches.length
    ? activeMatches.reduce<Verdict>(
        (strongest, item) => (VERDICT_WEIGHT[item.effect] > VERDICT_WEIGHT[strongest] ? item.effect : strongest),
        "allow",
      )
    : "block";

  if (activeMatches.length === 0) signals.push("No policy explicitly authorizes this tool request");

  const baseRisk = request.tool.risk === "destructive" ? 56 : request.tool.risk === "write" ? 34 : 12;
  const riskScore = Math.min(
    100,
    baseRisk + (injection ? 32 : 0) + (hasSecret(request.arguments) ? 18 : 0) + (request.environment === "production" ? 15 : 0),
  );

  const sanitizedArguments = redactSecrets(request.arguments) as Record<string, unknown>;
  const topPolicy = activeMatches[0];
  const explanation = topPolicy
    ? `${topPolicy.name} produced a ${verdict.toUpperCase()} verdict. ${signals[0] ?? topPolicy.description}`
    : "Default deny: the request did not match an explicit authorization policy.";

  return {
    decisionId: `dec_${randomUUID()}`,
    requestId: request.requestId,
    verdict,
    riskScore,
    matchedPolicies: activeMatches.map(({ id, name, effect, priority }) => ({ id, name, effect, priority })),
    signals,
    explanation,
    sanitizedArguments,
    approvalRequestId: verdict === "approval" ? `apr_${randomUUID()}` : undefined,
    evaluationMs: Number((performance.now() - started).toFixed(2)),
  };
}
