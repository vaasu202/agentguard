import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { Agent } from "@mastra/core/agent";

export async function runMastraAgent(prompt: string) {
  const baseURL = process.env.LITELLM_BASE_URL;
  const apiKey = process.env.LITELLM_API_KEY;
  const modelId = process.env.LITELLM_MODEL;
  if (!baseURL || !apiKey || !modelId) {
    throw new Error("LITELLM_BASE_URL, LITELLM_API_KEY, and LITELLM_MODEL are required");
  }

  const litellm = createOpenAICompatible({ name: "agentguard-litellm", baseURL, apiKey });
  const agent = new Agent({
    id: "agentguard-mastra-analyst",
    name: "AgentGuard Mastra analyst",
    description: "A TypeScript-native security workflow runner connected through LiteLLM.",
    instructions:
      "Analyze the supplied AgentGuard event. Return a concise risk summary, the likely policy outcome, and the evidence that supports it.",
    model: litellm(modelId),
  });
  const result = await agent.generate(prompt);
  return { runtime: "mastra" as const, output: result.text, live: true };
}
