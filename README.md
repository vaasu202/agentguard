# AgentGuard

Runtime security for AI agents. AgentGuard intercepts tool calls at an MCP boundary, validates provenance and arguments, applies deterministic policy precedence, redacts secrets, pauses sensitive actions for human approval, and writes a tamper-evident audit trail.

![AgentGuard attack lab](docs/images/agentguard-demo.png)

The application boots with a complete deterministic attack demo and **zero credentials**. Live adapters activate only when their hosted-service environment variables are present. AgentGuard never downloads a model and has no Ollama or local-vLLM fallback.

This is not a chatbot wrapper. It demonstrates agent security, protocol design, streaming UX, policy engineering, human-in-the-loop execution, multi-runtime architecture, observability, retrieval, evaluation, and hosted deployment.

Four attack fixtures prove four distinct controls:

| Fixture | Expected enforcement | Security control |
| --- | --- | --- |
| Indirect prompt injection | `BLOCK` | Untrusted provenance + destructive SQL |
| Secret exfiltration | `REDACT` | Recursive credential removal before egress |
| Production rollback | `APPROVAL` | Suspended execution + operator decision |
| Repository intelligence | `ALLOW` | Explicit read-only tool authorization |

## Stack, with a real job for each tool

| Technology | Implemented responsibility |
| --- | --- |
| Vercel AI SDK | Typed UI event streaming and hosted model calls |
| OpenAI Responses API | Explicit `responses()` inference route using GPT-5.6 |
| OpenAI Agents SDK | Primary hosted agent runtime connected to protected MCP tools |
| Model Context Protocol | Streamable HTTP gateway with six guarded tools |
| LangGraph | Stateful retrieve → assess → approve/finalize workflow |
| Mastra | TypeScript-native agent through LiteLLM |
| PydanticAI | Typed `SecurityAssessment` structured output |
| LiteLLM | Hosted provider routing, retry, and budget gateway |
| Hosted vLLM | Remote OpenAI-compatible serving adapter; never local |
| PostgreSQL + pgvector | Security-run persistence, checkpoints, semantic audit history |
| Qdrant | Hosted policy and attack-corpus vector retrieval |
| LlamaIndex | Ingestion and retrieval over the Qdrant collection |
| DSPy | Evaluation-driven policy-classifier optimization |
| Arize Phoenix | Hosted OpenTelemetry traces and evaluation visibility |

## Run the credential-free demo

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The first attack runs automatically. No `.env.local` is necessary.

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Repository map

```text
src/app/                         Next.js UI and API routes
src/components/                  Recruiter-facing attack console
src/lib/guard/                   Policy engine, schemas, fixtures, audit chain
src/lib/mcp/                     MCP server and protected real/simulated executors
src/lib/runtimes/                OpenAI Agents, Mastra, and Python-service adapters
src/lib/ai/                      LiteLLM and remote-vLLM model providers
services/intelligence/           Hosted FastAPI intelligence service
infrastructure/postgres/         pgvector schema
infrastructure/litellm/          Hosted LiteLLM routing config
tests/                           Policy and browser-level verification
docs/                            Architecture, threat model, demo, credentials
```

For the live architecture, see [Architecture](docs/ARCHITECTURE.md). For the exact optional keys and their destinations, see [Credentials](docs/CREDENTIALS.md). For interview delivery, use the [90-second demo script](docs/DEMO.md).

