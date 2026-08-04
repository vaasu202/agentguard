import postgres from "postgres";

let client: ReturnType<typeof postgres> | undefined;

export function getPostgresClient() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  client ??= postgres(process.env.DATABASE_URL, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "require",
  });
  return client;
}

export async function persistSecurityRun(run: {
  traceId: string;
  runtime: string;
  scenarioId: string;
  verdict: string;
  riskScore: number;
  payload: unknown;
}) {
  const sql = getPostgresClient();
  await sql`
    insert into security_runs (trace_id, runtime, scenario_id, verdict, risk_score, payload)
    values (${run.traceId}, ${run.runtime}, ${run.scenarioId}, ${run.verdict}, ${run.riskScore}, ${sql.json(run.payload as never)})
    on conflict (trace_id) do update set
      verdict = excluded.verdict,
      risk_score = excluded.risk_score,
      payload = excluded.payload
  `;
}
