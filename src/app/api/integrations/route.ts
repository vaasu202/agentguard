import { getIntegrationStatuses } from "@/lib/integrations/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const integrations = getIntegrationStatuses();
  return Response.json({
    mode: process.env.AGENTGUARD_DEMO_MODE === "false" ? "live" : "demo",
    configured: integrations.filter((item) => item.configured).length,
    total: integrations.length,
    integrations,
  });
}
