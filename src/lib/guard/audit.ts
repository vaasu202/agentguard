import { createHash, randomUUID } from "node:crypto";
import type { GuardDecision, GuardRequest } from "./types";

export interface AuditRecord {
  id: string;
  traceId: string;
  timestamp: string;
  event: string;
  requestId: string;
  tool: string;
  runtime: string;
  verdict: string;
  riskScore: number;
  previousHash: string;
  hash: string;
}

const globalAudit = globalThis as typeof globalThis & { __agentGuardAudit?: AuditRecord[] };
const records = (globalAudit.__agentGuardAudit ??= []);

function stableHash(value: Omit<AuditRecord, "hash">): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function appendAudit(traceId: string, request: GuardRequest, decision: GuardDecision): AuditRecord {
  const previousHash = records.at(-1)?.hash ?? "GENESIS";
  const base: Omit<AuditRecord, "hash"> = {
    id: `evt_${randomUUID()}`,
    traceId,
    timestamp: new Date().toISOString(),
    event: "policy.decision",
    requestId: request.requestId,
    tool: `${request.tool.server}.${request.tool.name}`,
    runtime: request.principal.runtime,
    verdict: decision.verdict,
    riskScore: decision.riskScore,
    previousHash,
  };
  const record = { ...base, hash: stableHash(base) };
  records.push(record);
  return record;
}

export function listAudit(): AuditRecord[] {
  return [...records].reverse();
}

export function verifyAuditChain(): boolean {
  return records.every((record, index) => {
    const { hash, ...base } = record;
    const expectedPrevious = index === 0 ? "GENESIS" : records[index - 1].hash;
    return record.previousHash === expectedPrevious && stableHash(base) === hash;
  });
}
