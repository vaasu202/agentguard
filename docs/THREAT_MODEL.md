# Threat model

## Protected assets

- Production data and deployment controls
- Provider, GitHub, Slack, and database credentials
- Integrity of policy decisions and approval records
- Confidentiality of retrieved context and outbound messages
- Availability of guarded tool execution

## Trust boundaries

1. User and retrieved content entering an agent runtime
2. Agent runtime crossing into the MCP gateway
3. Policy kernel releasing an executor call
4. Application services connecting to hosted inference and data providers
5. Operator approval changing a suspended request

## Covered threats

| Threat | Control |
| --- | --- |
| Indirect prompt injection | Provenance-aware injection detection and block precedence |
| Destructive or over-scoped tool use | Typed risk level, environment policy, default deny |
| Credential egress | Recursive outbound redaction before executor invocation |
| Unauthorized production changes | Human approval checkpoint |
| Cross-runtime policy drift | Shared deterministic kernel and conformance tests |
| Audit tampering | SHA-256 previous-hash chain and durable hosted persistence |
| Local model/data exposure | Hosted-only adapters; no local weight download or serving fallback |
| Arbitrary database reads | Fixed query allowlist; no caller-provided SQL on read tools |

## Explicit limitations before production

- Demo approvals use the API response state; production requires durable, single-use approval tokens with expiry and operator identity.
- The regex signal layer is intentionally explainable but should be supplemented with signed policy bundles and adversarial classifiers.
- Executor credentials need per-tool least privilege, rotation, and tenant isolation.
- Rate limiting, replay protection, CSRF protection, and enterprise SSO are deployment responsibilities.
- The in-process fallback audit store is not multi-instance durable; configure Postgres for deployed use.
- Live Slack and deployment actions should use idempotency keys and an outbox.

## Verification gates

- Policy unit suite must pass for every runtime.
- Production build and TypeScript validation must pass.
- Browser smoke tests cover auto-block, approval, and mobile overflow.
- A live deployment should add MCP protocol conformance, provider contract tests, and fault-injection around every hosted dependency.

