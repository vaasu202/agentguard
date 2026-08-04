import { z } from "zod";
import { RuntimeSchema } from "@/lib/guard/types";
import { runMastraAgent } from "@/lib/runtimes/mastra";
import { runOpenAIAgent } from "@/lib/runtimes/openai-agents";
import { runPythonAgent } from "@/lib/runtimes/python-service";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  runtime: RuntimeSchema,
  prompt: z.string().min(1).max(10_000),
});

export async function POST(request: Request) {
  const input = BodySchema.parse(await request.json());
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  try {
    const result =
      input.runtime === "openai-agents"
        ? await runOpenAIAgent(input.prompt, appUrl)
        : input.runtime === "mastra"
          ? await runMastraAgent(input.prompt)
          : await runPythonAgent(input.runtime, input.prompt);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        runtime: input.runtime,
        live: false,
        error: error instanceof Error ? error.message : "Hosted runtime failed",
        hint: "The deterministic Attack Lab remains available without credentials.",
      },
      { status: 503 },
    );
  }
}
