import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import { createLiteLLMModel, createRemoteVllmModel } from "@/lib/ai/providers";
import { withAgentGuardSpan } from "@/lib/telemetry/tracing";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  provider: z.enum(["openai-responses", "litellm", "hosted-vllm"]),
  prompt: z.string().min(1).max(10_000),
});

export async function POST(request: Request) {
  const input = BodySchema.parse(await request.json());

  try {
    const model =
      input.provider === "openai-responses"
        ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).responses(
            process.env.OPENAI_DEFAULT_MODEL ?? "gpt-5.6",
          )
        : input.provider === "litellm"
          ? createLiteLLMModel()
          : createRemoteVllmModel();

    const result = await withAgentGuardSpan(
      "agentguard.inference",
      { "gen_ai.provider": input.provider, "agentguard.hosted_only": true },
      () =>
        generateText({
          model,
          system:
            "You are an AgentGuard security analyst. Return a concise risk assessment and never claim that a protected tool executed without an execution receipt.",
          prompt: input.prompt,
        }),
    );

    return Response.json({ provider: input.provider, output: result.text, usage: result.usage, live: true });
  } catch (error) {
    return Response.json(
      {
        provider: input.provider,
        live: false,
        error: error instanceof Error ? error.message : "Hosted inference failed",
        hint: "This route never falls back to a local model.",
      },
      { status: 503 },
    );
  }
}
