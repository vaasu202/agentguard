import { z } from "zod";

const ApprovalSchema = z.object({
  approvalRequestId: z.string().startsWith("apr_"),
  action: z.enum(["approve", "reject"]),
  operator: z.string().default("portfolio-operator"),
});

export async function POST(request: Request) {
  const approval = ApprovalSchema.parse(await request.json());
  return Response.json({
    ...approval,
    status: approval.action === "approve" ? "executed" : "rejected",
    decidedAt: new Date().toISOString(),
    message:
      approval.action === "approve"
        ? "The suspended tool call was released with the approved arguments."
        : "The suspended tool call was terminated before execution.",
  });
}
