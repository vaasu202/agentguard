# 90-second recruiter demo

## Opening (10 seconds)

“AgentGuard is a zero-trust runtime security gateway for AI agents. Models can propose tool calls, but they cannot execute anything until a deterministic policy boundary grants passage.”

Point to the four runtime selectors and the credential-free badge.

## Attack one: indirect injection (25 seconds)

The demo starts automatically. Explain the three visual zones:

- OpenAI Agents proposes `database.execute`.
- The MCP request packet hits the policy beam.
- `AG-101`, `AG-102`, and `AG-103` match; block wins by precedence.

Point out “NEVER INVOKED” on the executor and the hash-chained event timeline.

## Attack two: secret egress (15 seconds)

Select **Secret exfiltration** and run it. The call is not simply rejected: AgentGuard recursively replaces the credential and releases only sanitized arguments. This demonstrates safe transformation, not just a binary guardrail.

## Attack three: production rollback (20 seconds)

Select **Production rollback**. Show that execution pauses at the same boundary and renders an operator checkpoint. Click Approve or Reject and explain that the action is recorded independently of model intent.

## Architecture proof (15 seconds)

Scroll to the topology:

“The UI stream is Vercel AI SDK; agents enter through OpenAI Agents, LangGraph, Mastra, or PydanticAI; all tools converge at MCP; LiteLLM and hosted vLLM make inference portable; LlamaIndex/Qdrant supply security context; Postgres stores the audit and graph checkpoints; DSPy optimizes the classifier; Phoenix receives traces.”

## Close (5 seconds)

“The important design choice is that the model is never the authorization layer. Every framework is replaceable; the security boundary is not.”

