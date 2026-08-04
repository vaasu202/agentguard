import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLiteLLMModel() {
  const baseURL = process.env.LITELLM_BASE_URL;
  const apiKey = process.env.LITELLM_API_KEY;
  const model = process.env.LITELLM_MODEL;
  if (!baseURL || !apiKey || !model) throw new Error("LiteLLM is not configured");
  return createOpenAICompatible({ name: "litellm", baseURL, apiKey })(model);
}

export function createRemoteVllmModel() {
  const baseURL = process.env.VLLM_BASE_URL;
  const apiKey = process.env.VLLM_API_KEY;
  const model = process.env.VLLM_MODEL;
  if (!baseURL || !apiKey || !model) throw new Error("Hosted vLLM is not configured");
  return createOpenAICompatible({ name: "remote-vllm", baseURL, apiKey })(model);
}
