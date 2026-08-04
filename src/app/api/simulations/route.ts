import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { z } from "zod";
import { runSimulation } from "@/lib/simulation/run";
import { RuntimeSchema, type SimulationEvent } from "@/lib/guard/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GuardUIMessage = UIMessage<never, { guardEvent: SimulationEvent }>;

const BodySchema = z.object({
  scenarioId: z.string(),
  runtime: RuntimeSchema.default("openai-agents"),
  pace: z.number().min(0.2).max(2).optional(),
});

export async function POST(request: Request) {
  const body = BodySchema.parse(await request.json());
  const stream = createUIMessageStream<GuardUIMessage>({
    execute: async ({ writer }) => {
      await runSimulation({
        ...body,
        onEvent: (event) => writer.write({ type: "data-guardEvent", data: event }),
      });
    },
    onError: (error) => (error instanceof Error ? error.message : "Simulation failed"),
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "Cache-Control": "no-store", "X-AgentGuard-Stream": "v1" },
  });
}
