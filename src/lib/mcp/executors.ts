import { getPostgresClient } from "@/lib/data/postgres";

export interface ToolExecutionResult {
  provider: string;
  simulated: boolean;
  data: unknown;
}

export async function searchGitHubIssues(arguments_: Record<string, unknown>): Promise<ToolExecutionResult> {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    return {
      provider: "github",
      simulated: true,
      data: [{ number: 184, title: "Harden MCP authorization boundary", state: "open" }],
    };
  }

  const query = String(arguments_.query ?? "");
  const limit = Math.min(Number(arguments_.limit ?? 5), 20);
  const params = new URLSearchParams({ q: `${query} repo:${repository}`, per_page: String(limit) });
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`https://api.github.com/search/issues?${params}`, { headers });
  if (!response.ok) throw new Error(`GitHub search failed with ${response.status}`);
  const body = (await response.json()) as { items: Array<Record<string, unknown>> };
  return {
    provider: "github",
    simulated: false,
    data: body.items.map(({ number, title, state, html_url }) => ({ number, title, state, url: html_url })),
  };
}

export async function sendSlackMessage(arguments_: Record<string, unknown>): Promise<ToolExecutionResult> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID || String(arguments_.channel ?? "");
  if (!token || !channel) {
    return { provider: "slack", simulated: true, data: { channel, timestamp: "demo.0001" } };
  }

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ channel, text: String(arguments_.message ?? "") }),
  });
  const body = (await response.json()) as { ok: boolean; error?: string; ts?: string; channel?: string };
  if (!response.ok || !body.ok) throw new Error(`Slack send failed: ${body.error ?? response.status}`);
  return { provider: "slack", simulated: false, data: { channel: body.channel, timestamp: body.ts } };
}

export async function runAllowlistedDatabaseQuery(arguments_: Record<string, unknown>): Promise<ToolExecutionResult> {
  const queryName = String(arguments_.queryName ?? "");
  if (!process.env.DATABASE_URL) {
    return { provider: "postgres", simulated: true, data: { queryName, rows: 12 } };
  }
  const sql = getPostgresClient();
  const rows =
    queryName === "recent_incidents"
      ? await sql`select trace_id, verdict, risk_score, created_at from security_runs order by created_at desc limit 10`
      : queryName === "policy_metrics"
        ? await sql`select verdict, count(*)::int as total, round(avg(risk_score), 1) as average_risk from security_runs group by verdict`
        : await sql`select count(*)::int as total_events, max(created_at) as latest_event from security_runs`;
  return { provider: "postgres", simulated: false, data: rows };
}
