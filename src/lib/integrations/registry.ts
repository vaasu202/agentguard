export interface IntegrationStatus {
  id: string;
  name: string;
  role: string;
  layer: "interface" | "runtime" | "protocol" | "data" | "observability" | "optimization" | "inference";
  configured: boolean;
  mode: "live" | "demo";
  detail: string;
}

function has(...keys: string[]): boolean {
  return keys.every((key) => Boolean(process.env[key]));
}

export function getIntegrationStatuses(): IntegrationStatus[] {
  return [
    {
      id: "vercel-ai-sdk",
      name: "Vercel AI SDK",
      role: "UI message and security-event streaming",
      layer: "interface",
      configured: true,
      mode: "live",
      detail: "Native Next.js stream transport",
    },
    {
      id: "openai-agents",
      name: "OpenAI Agents + Responses",
      role: "Primary hosted agent runtime",
      layer: "runtime",
      configured: has("OPENAI_API_KEY"),
      mode: has("OPENAI_API_KEY") ? "live" : "demo",
      detail: has("OPENAI_API_KEY") ? process.env.OPENAI_DEFAULT_MODEL ?? "Configured" : "Awaiting OPENAI_API_KEY",
    },
    {
      id: "mcp",
      name: "Model Context Protocol",
      role: "Guarded tool interoperability",
      layer: "protocol",
      configured: true,
      mode: "live",
      detail: "Streamable HTTP endpoint active",
    },
    {
      id: "langgraph",
      name: "LangGraph",
      role: "Checkpointed incident workflow",
      layer: "runtime",
      configured: has("PYTHON_SERVICE_URL", "PYTHON_SERVICE_API_KEY"),
      mode: has("PYTHON_SERVICE_URL", "PYTHON_SERVICE_API_KEY") ? "live" : "demo",
      detail: "Hosted Python intelligence service",
    },
    {
      id: "mastra",
      name: "Mastra",
      role: "TypeScript workflow runner",
      layer: "runtime",
      configured: has("LITELLM_BASE_URL", "LITELLM_API_KEY", "LITELLM_MODEL"),
      mode: has("LITELLM_BASE_URL", "LITELLM_API_KEY", "LITELLM_MODEL") ? "live" : "demo",
      detail: "Uses LiteLLM through AI SDK",
    },
    {
      id: "pydantic-ai",
      name: "PydanticAI",
      role: "Typed Python security agent",
      layer: "runtime",
      configured: has("PYTHON_SERVICE_URL", "PYTHON_SERVICE_API_KEY"),
      mode: has("PYTHON_SERVICE_URL", "PYTHON_SERVICE_API_KEY") ? "live" : "demo",
      detail: "Validated outputs and dependency injection",
    },
    {
      id: "litellm",
      name: "LiteLLM",
      role: "Central model gateway and budget controls",
      layer: "inference",
      configured: has("LITELLM_BASE_URL", "LITELLM_API_KEY"),
      mode: has("LITELLM_BASE_URL", "LITELLM_API_KEY") ? "live" : "demo",
      detail: "Remote OpenAI-compatible gateway",
    },
    {
      id: "vllm",
      name: "Hosted vLLM",
      role: "Remote open-model serving track",
      layer: "inference",
      configured: has("VLLM_BASE_URL", "VLLM_API_KEY", "VLLM_MODEL"),
      mode: has("VLLM_BASE_URL", "VLLM_API_KEY", "VLLM_MODEL") ? "live" : "demo",
      detail: "Remote endpoint only; no local model",
    },
    {
      id: "postgres",
      name: "PostgreSQL + pgvector",
      role: "Audit persistence and semantic history",
      layer: "data",
      configured: has("DATABASE_URL"),
      mode: has("DATABASE_URL") ? "live" : "demo",
      detail: "Hosted database adapter",
    },
    {
      id: "qdrant",
      name: "Qdrant",
      role: "Attack corpus and policy retrieval",
      layer: "data",
      configured: has("QDRANT_URL", "QDRANT_API_KEY"),
      mode: has("QDRANT_URL", "QDRANT_API_KEY") ? "live" : "demo",
      detail: "Hosted vector search",
    },
    {
      id: "llamaindex",
      name: "LlamaIndex",
      role: "Security-document ingestion and RAG",
      layer: "data",
      configured: has("PYTHON_SERVICE_URL", "QDRANT_URL"),
      mode: has("PYTHON_SERVICE_URL", "QDRANT_URL") ? "live" : "demo",
      detail: "Remote Python ingestion pipeline",
    },
    {
      id: "dspy",
      name: "DSPy",
      role: "Evaluation-driven prompt optimization",
      layer: "optimization",
      configured: has("PYTHON_SERVICE_URL", "LITELLM_BASE_URL"),
      mode: has("PYTHON_SERVICE_URL", "LITELLM_BASE_URL") ? "live" : "demo",
      detail: "Optimizes against attack fixtures",
    },
    {
      id: "phoenix",
      name: "Arize Phoenix",
      role: "OpenTelemetry traces and evaluations",
      layer: "observability",
      configured: has("PHOENIX_COLLECTOR_ENDPOINT", "PHOENIX_API_KEY"),
      mode: has("PHOENIX_COLLECTOR_ENDPOINT", "PHOENIX_API_KEY") ? "live" : "demo",
      detail: "Hosted OTLP collector",
    },
  ];
}
