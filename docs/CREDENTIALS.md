# Credential map

## The important answer

You need **no credentials** to run or present the main Attack Lab. Copying `.env.example` is optional; the app defaults to deterministic demo mode.

When you want to demonstrate live hosted integrations, create this file:

```text
C:\Users\vsohe\OneDrive\Documents\Resume Projects\.env.local
```

Never commit that file. It is already ignored by Git.

## Root Next.js application (`.env.local`)

| Variable | Where it comes from | Required for |
| --- | --- | --- |
| `OPENAI_API_KEY` | OpenAI project key | OpenAI Agents + Responses live calls |
| `OPENAI_DEFAULT_MODEL` | Use `gpt-5.6` unless intentionally changed | Model selection |
| `LITELLM_BASE_URL` | URL of your deployed LiteLLM proxy, normally ending in `/v1` | Mastra, DSPy, routed inference |
| `LITELLM_API_KEY` | LiteLLM virtual/master key | Authenticate to that proxy |
| `LITELLM_MODEL` | `agentguard-primary` from the included config | Routed model alias |
| `VLLM_BASE_URL` | OpenAI-compatible URL from a **remote hosted** vLLM service | Hosted open-model path |
| `VLLM_API_KEY` | Key issued by that remote service | Authenticate to hosted vLLM |
| `VLLM_MODEL` | Model ID exposed by that service | Remote model selection |
| `PYTHON_SERVICE_URL` | Public HTTPS URL of `services/intelligence` | LangGraph and PydanticAI runtime calls |
| `PYTHON_SERVICE_API_KEY` | A random secret you create | Authenticate Next.js to the Python service |
| `DATABASE_URL` | TLS connection string from hosted PostgreSQL | Audit persistence + pgvector |
| `QDRANT_URL` | Hosted Qdrant cluster URL | Policy/attack retrieval |
| `QDRANT_API_KEY` | Hosted Qdrant API key | Qdrant authentication |
| `PHOENIX_COLLECTOR_ENDPOINT` | Hosted Phoenix OTLP HTTP endpoint, including `/v1/traces` | Trace export |
| `PHOENIX_API_KEY` | Phoenix system/API key | Trace authentication |
| `GITHUB_REPOSITORY` | `owner/repository` | Real issue search through MCP |
| `GITHUB_TOKEN` | Fine-grained read-only GitHub token; optional for public repositories | Higher GitHub API limits/private repos |
| `SLACK_BOT_TOKEN` | Slack bot token with `chat:write` | Real protected Slack sends |
| `SLACK_CHANNEL_ID` | Target channel ID | Restrict Slack output destination |

## Hosted Python service

Deploy `services/intelligence/Dockerfile` to any online container host. In that host's environment-variable dashboard, set:

```dotenv
SERVICE_API_KEY=<same value as root PYTHON_SERVICE_API_KEY>
OPENAI_API_KEY=<same OpenAI project key>
OPENAI_DEFAULT_MODEL=gpt-5.6
DATABASE_URL=<hosted postgres TLS URL>
QDRANT_URL=<hosted qdrant URL>
QDRANT_API_KEY=<qdrant key>
QDRANT_COLLECTION=agentguard-context
LITELLM_BASE_URL=<hosted LiteLLM /v1 URL>
LITELLM_API_KEY=<LiteLLM key>
LITELLM_MODEL=agentguard-primary
PHOENIX_COLLECTOR_ENDPOINT=<hosted Phoenix /v1/traces URL>
PHOENIX_API_KEY=<Phoenix key>
PHOENIX_PROJECT_NAME=agentguard
```

`SERVICE_API_KEY` is not a paid vendor credential. Generate any long random string and use the same value in both deployments.

## Hosted LiteLLM service

Deploy LiteLLM online with `infrastructure/litellm/config.yaml`. Its deployment needs:

```dotenv
LITELLM_MASTER_KEY=<a random secret you create>
OPENAI_API_KEY=<provider key>
OPENAI_DEFAULT_MODEL=gpt-5.6
DATABASE_URL=<hosted postgres URL>
VLLM_BASE_URL=<optional remote vLLM /v1 URL>
VLLM_API_KEY=<optional remote key>
VLLM_MODEL=<optional remote model ID>
```

Then use the LiteLLM public URL and master/virtual key as `LITELLM_BASE_URL` and `LITELLM_API_KEY` in the two application deployments.

## Cheapest presentation strategy

1. Use the credential-free Attack Lab for the interview; it proves the enforcement design without spending anything.
2. If you later receive provider credits, add only `OPENAI_API_KEY` for one live Responses/Agents demonstration.
3. Add the hosted data and observability services only when you specifically want to show those dashboards.
4. Leave remote vLLM unconfigured unless a hosted provider gives you an endpoint. AgentGuard will never download it locally.

