import type { AgentRuntime } from "@/lib/guard/types";

export async function runPythonAgent(runtime: Extract<AgentRuntime, "langgraph" | "pydantic-ai">, prompt: string) {
  const baseUrl = process.env.PYTHON_SERVICE_URL;
  const apiKey = process.env.PYTHON_SERVICE_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("PYTHON_SERVICE_URL and PYTHON_SERVICE_API_KEY are required");

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/runners/${runtime}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Hosted ${runtime} service returned ${response.status}`);
  return { runtime, ...(await response.json()), live: true };
}
