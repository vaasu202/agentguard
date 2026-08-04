"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Ban,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  Fingerprint,
  GitBranch,
  LockKeyhole,
  Network,
  Play,
  Radio,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Waypoints,
  X,
  Zap,
} from "lucide-react";
import { ATTACK_SCENARIOS } from "@/lib/guard/scenarios";
import type { AgentRuntime, GuardDecision, SimulationEvent, Verdict } from "@/lib/guard/types";

type IntegrationStatus = {
  id: string;
  name: string;
  role: string;
  layer: string;
  configured: boolean;
  mode: "live" | "demo";
  detail: string;
};

type Phase = "idle" | "thinking" | "requested" | "scanning" | "decided" | "blocked" | "released" | "held" | "complete";

const RUNTIMES: Array<{ id: AgentRuntime; name: string; short: string; accent: string }> = [
  { id: "openai-agents", name: "OpenAI Agents", short: "OA", accent: "Responses API" },
  { id: "langgraph", name: "LangGraph", short: "LG", accent: "State graph" },
  { id: "mastra", name: "Mastra", short: "MA", accent: "TypeScript agent" },
  { id: "pydantic-ai", name: "PydanticAI", short: "PY", accent: "Typed agent" },
];

const DEFAULT_STACK: IntegrationStatus[] = [
  ["vercel-ai-sdk", "Vercel AI SDK", "Structured event streaming", "interface"],
  ["openai-agents", "OpenAI Agents", "Responses runtime", "runtime"],
  ["mcp", "MCP", "Guarded tool protocol", "protocol"],
  ["langgraph", "LangGraph", "Stateful workflow", "runtime"],
  ["mastra", "Mastra", "TypeScript workflow", "runtime"],
  ["pydantic-ai", "PydanticAI", "Typed security agent", "runtime"],
  ["litellm", "LiteLLM", "Model gateway", "inference"],
  ["vllm", "Hosted vLLM", "Remote serving", "inference"],
  ["postgres", "Postgres + pgvector", "Audit memory", "data"],
  ["qdrant", "Qdrant", "Attack retrieval", "data"],
  ["llamaindex", "LlamaIndex", "Security RAG", "data"],
  ["dspy", "DSPy", "Prompt optimization", "optimization"],
  ["phoenix", "Phoenix", "Tracing + evals", "observability"],
].map(([id, name, role, layer]) => ({ id, name, role, layer, configured: ["vercel-ai-sdk", "mcp"].includes(id), mode: ["vercel-ai-sdk", "mcp"].includes(id) ? "live" : "demo", detail: "Hosted adapter ready" })) as IntegrationStatus[];

function phaseForEvent(type: SimulationEvent["type"]): Phase {
  if (type === "agent.context" || type === "agent.intent") return "thinking";
  if (type === "tool.requested") return "requested";
  if (type === "guard.validating" || type === "guard.signal") return "scanning";
  if (type === "guard.decision") return "decided";
  if (type === "tool.blocked") return "blocked";
  if (type === "tool.executed") return "released";
  if (type === "approval.pending") return "held";
  if (type === "run.completed") return "complete";
  return "idle";
}

function verdictTone(verdict?: Verdict) {
  if (verdict === "allow") return "safe";
  if (verdict === "block") return "danger";
  if (verdict === "approval") return "warning";
  if (verdict === "redact") return "redact";
  return "neutral";
}

export function AgentGuardConsole() {
  const [scenarioId, setScenarioId] = useState(ATTACK_SCENARIOS[0].id);
  const [runtime, setRuntime] = useState<AgentRuntime>("openai-agents");
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [decision, setDecision] = useState<GuardDecision | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [running, setRunning] = useState(false);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>(DEFAULT_STACK);
  const [approvalState, setApprovalState] = useState<"pending" | "approving" | "executed" | "rejected">("pending");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasAutoRun = useRef(false);

  const scenario = useMemo(() => ATTACK_SCENARIOS.find((item) => item.id === scenarioId) ?? ATTACK_SCENARIOS[0], [scenarioId]);
  const activeRuntime = RUNTIMES.find((item) => item.id === runtime) ?? RUNTIMES[0];
  const currentEvent = events.at(-1);

  useEffect(() => {
    fetch("/api/integrations")
      .then((response) => response.json())
      .then((data: { integrations?: IntegrationStatus[] }) => data.integrations && setIntegrations(data.integrations))
      .catch(() => undefined);
    return () => abortRef.current?.abort();
  }, []);

  const runDemo = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setEvents([]);
    setDecision(null);
    setApprovalState("pending");
    setError(null);
    setPhase("idle");
    setRunning(true);

    try {
      const response = await fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, runtime, pace: 0.82 }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`Stream unavailable (${response.status})`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) continue;
          const encoded = line.slice(5).trim();
          if (!encoded || encoded === "[DONE]") continue;
          const chunk = JSON.parse(encoded) as { type?: string; data?: SimulationEvent };
          if (chunk.type !== "data-guardEvent" || !chunk.data) continue;
          const event = chunk.data;
          setEvents((previous) => [...previous, event]);
          setPhase(phaseForEvent(event.type));
          const nextDecision = event.payload?.decision as GuardDecision | undefined;
          if (nextDecision) setDecision(nextDecision);
        }
      }
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") setError(caught instanceof Error ? caught.message : "Demo failed");
    } finally {
      if (!controller.signal.aborted) setRunning(false);
    }
  }, [runtime, scenarioId]);

  useEffect(() => {
    if (hasAutoRun.current) return;
    hasAutoRun.current = true;
    const timeout = window.setTimeout(() => void runDemo(), 650);
    return () => window.clearTimeout(timeout);
  }, [runDemo]);

  const decideApproval = async (action: "approve" | "reject") => {
    if (!decision?.approvalRequestId) return;
    setApprovalState("approving");
    const response = await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalRequestId: decision.approvalRequestId, action }),
    });
    const data = (await response.json()) as { status: "executed" | "rejected" };
    setApprovalState(data.status);
  };

  const configuredCount = integrations.filter((item) => item.configured).length;
  const verdict = decision?.verdict;

  return (
    <main className={`app-shell tone-${verdictTone(verdict)}`}>
      <div className="noise" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="AgentGuard home">
          <span className="brand-mark"><ShieldCheck size={18} strokeWidth={2.4} /></span>
          <span>AGENT<span>/GUARD</span></span>
          <sup>LABS</sup>
        </a>
        <div className="topbar-center">
          <span className="pulse-dot" />
          POLICY ENGINE ONLINE
          <span className="topbar-separator" />
          <span>{configuredCount}/{integrations.length} ADAPTERS READY</span>
        </div>
        <div className="mode-chip"><Sparkles size={13} /> CREDENTIAL-FREE DEMO</div>
      </header>

      <div className="workspace" id="top">
        <aside className="rail">
          <div className="rail-label">CONTROL</div>
          <nav>
            <a className="active" href="#live"><Activity size={17} /><span>Live guard</span></a>
            <a href="#scenarios"><Zap size={17} /><span>Attack lab</span></a>
            <a href="#policies"><Fingerprint size={17} /><span>Policies</span></a>
            <a href="#stack"><Network size={17} /><span>Topology</span></a>
            <a href="#timeline"><Clock3 size={17} /><span>Audit trail</span></a>
          </nav>
          <div className="rail-foot">
            <div className="rail-stat"><span>GUARDED</span><strong>1,284</strong></div>
            <div className="rail-stat"><span>BLOCK RATE</span><strong>18.7%</strong></div>
            <div className="rail-hash">SHA-256 CHAIN<br />VERIFIED</div>
          </div>
        </aside>

        <div className="content">
          <section className="hero" id="live">
            <div>
              <div className="eyebrow"><span>RUNTIME SECURITY</span><i /> MODEL-AGNOSTIC</div>
              <h1>Every tool call<br /><em>earns passage.</em></h1>
              <p>AgentGuard intercepts AI agent actions at the MCP boundary, evaluates policy, removes secrets, and suspends dangerous execution before infrastructure is touched.</p>
            </div>
            <div className="hero-readout">
              <span>ACTIVE CONTROL</span>
              <strong>DEFAULT<br />DENY</strong>
              <small>ZERO-TRUST / TOOL EXECUTION</small>
            </div>
          </section>

          <section className="runtime-strip" aria-label="Agent runtime">
            <div className="section-kicker">01 / SELECT RUNTIME</div>
            <div className="runtime-options">
              {RUNTIMES.map((item) => (
                <button key={item.id} className={runtime === item.id ? "active" : ""} onClick={() => setRuntime(item.id)} disabled={running}>
                  <span className="runtime-monogram">{item.short}</span>
                  <span><strong>{item.name}</strong><small>{item.accent}</small></span>
                  {runtime === item.id && <Check size={14} />}
                </button>
              ))}
            </div>
          </section>

          <section className="lab-grid" id="scenarios">
            <div className="scenario-panel panel-frame">
              <div className="panel-heading">
                <span>02 / ATTACK VECTOR</span>
                <small>{ATTACK_SCENARIOS.length} FIXTURES</small>
              </div>
              <div className="scenario-list">
                {ATTACK_SCENARIOS.map((item) => (
                  <button key={item.id} className={scenarioId === item.id ? "active" : ""} onClick={() => setScenarioId(item.id)} disabled={running}>
                    <span className="scenario-index">{item.index}</span>
                    <span><small>{item.label}</small><strong>{item.title}</strong></span>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
              <div className="scenario-brief">
                <div className="brief-label">ADVERSARIAL INPUT</div>
                <p>“{scenario.command}”</p>
                <dl>
                  <div><dt>Source</dt><dd>{scenario.source}</dd></div>
                  <div><dt>Expected</dt><dd className={`text-${scenario.expectedVerdict}`}>{scenario.expectedVerdict.toUpperCase()}</dd></div>
                  <div><dt>Policy focus</dt><dd>{scenario.policyFocus}</dd></div>
                </dl>
              </div>
              <button className="run-button" onClick={() => void runDemo()} disabled={running}>
                {running ? <><Radio className="spin-pulse" size={17} /> INTERCEPTING LIVE</> : <><Play size={17} fill="currentColor" /> RUN ATTACK</>}
                <span>{activeRuntime.short}</span>
              </button>
            </div>

            <section className={`intercept-stage panel-frame phase-${phase} verdict-${verdict ?? "none"}`} aria-label="Live policy interception visualization">
              <div className="stage-header">
                <div><span className="live-dot" /> LIVE INTERCEPTION</div>
                <div>TRACE {currentEvent?.traceId.slice(-8).toUpperCase() ?? "STANDBY"}</div>
              </div>
              <div className="stage-grid" aria-hidden="true" />
              <div className="flow-label flow-agent">01 / AGENT</div>
              <div className="flow-label flow-boundary">02 / POLICY BOUNDARY</div>
              <div className="flow-label flow-tool">03 / EXECUTOR</div>

              <div className="agent-node flow-node">
                <div className="node-orbit"><CircleDot size={24} /></div>
                <strong>{activeRuntime.short}</strong>
                <span>{activeRuntime.name}</span>
                <small>{phase === "thinking" ? "FORMING ACTION..." : "AGENT RUNTIME"}</small>
              </div>

              <div className="route-line route-before" />
              <div className="route-line route-after" />
              <div className="request-packet">
                <span className="packet-glow" />
                <TerminalSquare size={14} />
                <small>TOOL_CALL</small>
              </div>

              <div className="guard-boundary">
                <span className="beam beam-one" />
                <span className="beam beam-two" />
                <span className="beam-core" />
                <span className="scan-head" />
                <div className="guard-sigil">
                  {verdict === "block" ? <Ban size={25} /> : verdict === "allow" ? <Check size={25} /> : <ScanLine size={25} />}
                </div>
                <strong>AG</strong>
                <small>{phase === "scanning" ? "EVALUATING" : verdict ? verdict.toUpperCase() : "STANDBY"}</small>
              </div>

              <div className="impact-ring"><span /><span /><span /></div>

              <div className="tool-node flow-node">
                <div className="node-orbit"><Database size={23} /></div>
                <strong>MCP</strong>
                <span>{scenario.request.tool.name}</span>
                <small>{phase === "blocked" ? "NEVER INVOKED" : phase === "released" ? "EXECUTED" : phase === "held" ? "SUSPENDED" : "PROTECTED TOOL"}</small>
              </div>

              <div className="stage-caption">
                <span>{currentEvent?.title ?? "Awaiting security run"}</span>
                <p>{currentEvent?.detail ?? "Choose a fixture and run it through the policy boundary."}</p>
              </div>
            </section>

            <aside className={`decision-panel panel-frame verdict-${verdict ?? "none"}`}>
              <div className="panel-heading">
                <span>03 / VERDICT</span>
                <small>{decision ? `${decision.evaluationMs} MS` : "WAITING"}</small>
              </div>
              <div className="verdict-lockup">
                <div className="verdict-icon">
                  {verdict === "block" ? <Ban /> : verdict === "allow" ? <ShieldCheck /> : verdict === "redact" ? <ScanLine /> : verdict === "approval" ? <Clock3 /> : <LockKeyhole />}
                </div>
                <div><span>ENFORCEMENT RESULT</span><strong>{verdict?.toUpperCase() ?? "—"}</strong></div>
              </div>
              <div className="risk-meter">
                <div><span>COMPOSITE RISK</span><strong>{decision?.riskScore ?? 0}<small>/100</small></strong></div>
                <div className="meter-track"><i style={{ transform: `scaleX(${(decision?.riskScore ?? 0) / 100})` }} /></div>
              </div>

              <div className="decision-section">
                <span>MATCHED CONTROL</span>
                {decision?.matchedPolicies.length ? decision.matchedPolicies.slice(0, 3).map((policy) => (
                  <div className="policy-match" key={policy.id}>
                    <b>{policy.id}</b><p>{policy.name}</p><em>{policy.effect}</em>
                  </div>
                )) : <div className="empty-row">No decision emitted yet</div>}
              </div>

              <div className="decision-section signals">
                <span>SECURITY SIGNALS</span>
                {decision?.signals.slice(0, 3).map((signal) => <p key={signal}><X size={12} />{signal}</p>) ?? <p className="muted"><CircleDot size={12} />Awaiting inspection</p>}
              </div>

              {verdict === "approval" && (
                <div className="approval-box">
                  <span>HUMAN CHECKPOINT</span>
                  {approvalState === "pending" ? (
                    <><p>Execution is suspended. Operator authorization is required.</p><div><button onClick={() => void decideApproval("reject")}><X size={13} /> Reject</button><button onClick={() => void decideApproval("approve")}><Check size={13} /> Approve</button></div></>
                  ) : <p className={`approval-result ${approvalState}`}>{approvalState === "approving" ? "Recording signed decision..." : approvalState === "executed" ? "Approved and released." : "Rejected before execution."}</p>}
                </div>
              )}
              {error && <div className="error-box">{error}</div>}
            </aside>
          </section>

          <section className="timeline panel-frame" id="timeline">
            <div className="panel-heading">
              <span>04 / TAMPER-EVIDENT EVENT STREAM</span>
              <small><Fingerprint size={12} /> SHA-256 HASH CHAIN</small>
            </div>
            <div className="timeline-track">
              {events.length === 0 ? <div className="timeline-empty">A signed audit trail will materialize here.</div> : events.map((event) => (
                <div className={`timeline-event tone-${event.tone}`} key={event.id}>
                  <div className="event-seq">{String(event.sequence + 1).padStart(2, "0")}</div>
                  <div className="event-dot" />
                  <div><span>{event.type}</span><strong>{event.title}</strong><p>{event.detail}</p></div>
                </div>
              ))}
            </div>
          </section>

          <section className="stack-section" id="stack">
            <div className="stack-copy">
              <div className="eyebrow"><span>ARCHITECTURE PROOF</span><i /> HOSTED-ONLY INFERENCE</div>
              <h2>One boundary.<br /><em>Every modern runtime.</em></h2>
              <p>The demo works offline from credentials; each adapter switches to its real hosted service the moment its environment variables are present.</p>
              <div className="topology-legend"><span><i className="live" /> ACTIVE NOW</span><span><i /> ADAPTER READY</span></div>
            </div>
            <div className="topology panel-frame">
              <div className="topology-core"><ShieldCheck size={25} /><strong>AGENTGUARD</strong><span>POLICY KERNEL</span></div>
              <div className="topology-lines" aria-hidden="true"><i /><i /><i /><i /><i /></div>
              <div className="stack-grid">
                {integrations.map((item, index) => (
                  <div className={`stack-card ${item.configured ? "live" : "ready"}`} key={item.id} style={{ "--order": index } as React.CSSProperties}>
                    <div>{item.layer === "runtime" ? <GitBranch size={15} /> : item.layer === "data" ? <Database size={15} /> : item.layer === "protocol" ? <Waypoints size={15} /> : item.layer === "observability" ? <Activity size={15} /> : <Network size={15} />}</div>
                    <span><strong>{item.name}</strong><small>{item.role}</small></span>
                    <i title={item.configured ? "Live" : "Credential adapter ready"} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="policy-strip" id="policies">
            <div><span>POLICY PRECEDENCE</span><strong>BLOCK</strong><ChevronRight /><strong>APPROVAL</strong><ChevronRight /><strong>REDACT</strong><ChevronRight /><strong>ALLOW</strong></div>
            <div><span>SECURITY MODEL</span><strong>SCHEMA VALIDATION / PROVENANCE / LEAST PRIVILEGE / AUDIT CHAIN</strong></div>
          </section>

          <footer>
            <div className="brand footer-brand"><span className="brand-mark"><ShieldCheck size={18} /></span><span>AGENT<span>/GUARD</span></span></div>
            <p>RUNTIME SECURITY FOR AGENTIC SYSTEMS</p>
            <button onClick={() => { setScenarioId(ATTACK_SCENARIOS[0].id); setRuntime("openai-agents"); window.scrollTo({ top: 0, behavior: "smooth" }); }}><RotateCcw size={13} /> RESET LAB</button>
          </footer>
        </div>
      </div>
    </main>
  );
}
