import { listAudit, verifyAuditChain } from "@/lib/guard/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ verified: verifyAuditChain(), records: listAudit() });
}
