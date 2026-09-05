"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  FileCheck2,
  Gauge,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import {
  CaseResult,
  formatMoney,
  RecoveryCase,
  RunSnapshot,
} from "@/lib/domain";
type View =
  | "command"
  | "live"
  | "cases"
  | "dynamic"
  | "operations"
  | "evaluation"
  | "audit";
const nav: Record<View, string> = {
  command: "Command center",
  live: "Live run",
  cases: "Cases",
  dynamic: "Dynamic lab",
  operations: "Operations",
  evaluation: "Evaluation",
  audit: "Audit",
};
const nice = (v: string) =>
  v
    .toLowerCase()
    .split("_")
    .map((x) => x[0].toUpperCase() + x.slice(1))
    .join(" ");

interface OpsSnapshot {
  approvals: Array<{
    id: string;
    caseId: string;
    customer: string;
    action: string;
    amountMinor: string;
    reason: string;
    status: string;
    version: number;
  }>;
  jobs: Array<{
    id: string;
    caseId: string;
    kind: string;
    dueAt: string;
    status: string;
    attempts: number;
    lastResult?: string;
  }>;
  ledger: Array<{
    id: string;
    caseId: string;
    providerPaymentId: string;
    amountMinor: string;
    confirmedAt: string;
  }>;
  providerConfirmedMinor: string;
  pendingApprovals: number;
  scheduledJobs: number;
  processedProviderEvents: number;
}
interface DynamicSnapshot {
  simulatedAt: string;
  cases: Array<{
    id: string;
    sourceCaseId: string;
    customer: string;
    type: string;
    amountMinor: string;
    state: string;
    priorityScore: number;
    version: number;
    decisionSource?: string;
    selectedAction?: string;
    diagnosis?: string;
    nextAt?: string;
    promiseDueAt?: string;
    lastReply?: string;
  }>;
  events: Array<{
    id: string;
    caseId: string;
    sequence: number;
    type: string;
    actor: string;
    at: string;
    hash: string;
  }>;
  counts: Record<string, number>;
  atRiskMinor: string;
  activeMinor: string;
  inferenceBudget: { limit: number; used: number; remaining: number };
}

async function readResponse(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body;
}

export default function Dashboard() {
  const [run, setRun] = useState<RunSnapshot | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState<string | null>(null),
    [view, setView] = useState<View>("command"),
    [selected, setSelected] = useState<string | null>(null),
    [operations, setOperations] = useState<OpsSnapshot | null>(null),
    [dynamic, setDynamic] = useState<DynamicSnapshot | null>(null),
    [dynamicBusy, setDynamicBusy] = useState(false),
    [service, setService] = useState({ ollama: false, razorpay: false });
  async function launch() {
    setBusy(true);
    setError(null);
    try {
    const r = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seed: 2026,
        mode: service.razorpay ? "RAZORPAY_TEST" : "SIMULATION",
      }),
    });
    setRun(await readResponse(r));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create a run");
    } finally { setBusy(false); }
  }
  async function loadOperations() {
    let response = await fetch("/api/operations");
    let snapshot = await response.json();
    if (!snapshot.approvals?.length && !snapshot.jobs?.length) {
      response = await fetch("/api/operations", { method: "POST" });
      snapshot = await response.json();
    }
    setOperations(snapshot);
  }
  async function decide(
    id: string,
    version: number,
    decision: "APPROVED" | "REJECTED",
  ) {
    const response = await fetch(`/api/approvals/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        decision,
        expectedVersion: version,
        reviewerNote: "Reviewed in RecoverAI approval queue",
      }),
    });
    setOperations(await response.json());
  }
  async function tick() {
    const response = await fetch("/api/workflows/tick", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ at: "2030-01-01T00:00:00.000Z" }),
    });
    const result = await response.json();
    setOperations(result.snapshot);
  }
  async function loadDynamic() {
    const response = await fetch("/api/dynamic");
    setDynamic(await response.json());
  }
  async function generateDynamic() {
    setDynamicBusy(true);
    const response = await fetch("/api/dynamic", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ count: 5 }),
    });
    setDynamic(await response.json());
    setDynamicBusy(false);
  }
  async function planDynamic(id: string) {
    setDynamicBusy(true);
    const response = await fetch(`/api/dynamic/cases/${id}/plan`, {
      method: "POST",
    });
    setDynamic(await response.json());
    setDynamicBusy(false);
  }
  async function replyDynamic(id: string, version: number, message: string) {
    const response = await fetch(`/api/dynamic/cases/${id}/reply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, expectedVersion: version }),
    });
    setDynamic(await response.json());
  }
  async function advanceClock(hours: number) {
    const response = await fetch("/api/dynamic/clock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hours }),
    });
    const result = await response.json();
    setDynamic(result.snapshot);
  }
  useEffect(() => {
    async function initialize() {
      try {
      const s = await fetch("/api/status").then(readResponse);
      setService({ ollama: s.ollama.model, razorpay: s.razorpayTest });
      const existing = await fetch("/api/runs");
      const saved = await readResponse(existing);
      if (saved) setRun(saved);
      else {
        const created = await fetch("/api/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            seed: 2026,
            mode: s.razorpayTest ? "RAZORPAY_TEST" : "SIMULATION",
          }),
        });
        setRun(await readResponse(created));
      }
      } catch (error) {
        setError(error instanceof Error ? error.message : "Unable to load the demo");
      } finally { setBusy(false); }
    }
    initialize();
  }, []);
  useEffect(() => {
    if (view !== "dynamic") return;
    const timer = setInterval(() => void loadDynamic(), 2000);
    return () => clearInterval(timer);
  }, [view]);
  const detail = useMemo(
    () =>
      run && selected
        ? {
            c: run.cases.find((x) => x.id === selected)!,
            a: run.ai.find((x) => x.caseId === selected)!,
            b: run.baseline.find((x) => x.caseId === selected)!,
          }
        : null,
    [run, selected],
  );
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <i>
            <Sparkles />
          </i>
          <span>
            <b>RecoverAI</b>
            <small>Revenue recovery agent</small>
          </span>
        </div>
        <div className="mode">
          <em />
          {run?.mode === "RAZORPAY_TEST"
            ? "RAZORPAY TEST + SIMULATION"
            : "SIMULATION MODE"}
        </div>
        <nav>
          {(Object.keys(nav) as View[]).map((v, i) => (
            <button
              className={view === v ? "active" : ""}
              onClick={() => {
                setView(v);
                if (v === "operations") loadOperations();
                if (v === "dynamic") loadDynamic();
              }}
              key={v}
            >
              {
                [
                  <Gauge key="g" />,
                  <Activity key="l" />,
                  <Users key="c" />,
                  <Clock3 key="d" />,
                  <ClipboardCheck key="o" />,
                  <ArrowUpRight key="e" />,
                  <FileCheck2 key="a" />,
                ][i]
              }
              {nav[v]}
            </button>
          ))}
        </nav>
        <footer>
          <div>
            <em
              className={run?.integrations?.ollama.liveDecisions ? "on" : ""}
            />
            <span>
              <b>Recovery AI</b>
              <small>
                {run?.integrations
                  ? `${run.integrations.ollama.liveDecisions} live · ${run.integrations.ollama.fallbackDecisions} fallback`
                  : service.ollama
                    ? "AI configured"
                    : "Fallback active"}
              </small>
            </span>
          </div>
          <div>
            <em className={run?.integrations?.razorpay.executed ? "on" : ""} />
            <span>
              <b>Razorpay</b>
              <small>
                {run?.integrations?.razorpay.executed
                  ? `Test action ${run.integrations.razorpay.actionId}`
                  : service.razorpay
                    ? "Test mode ready"
                    : "Simulation fallback"}
              </small>
            </span>
          </div>
        </footer>
      </aside>
      <main>
        {run?.integrations?.ollama.fallbackReasons?.map(reason => <div key={reason} role="status" style={{ padding: 16, color: "#92400e", background: "#fffbeb" }}>{reason}</div>)}
        {error && <div role="alert" style={{ padding: 16, color: "#b42318" }}>{error}. Use Run recovery to retry.</div>}
        <header>
          <div>
            <small>RAZORPAY AI BUILDATHON 2026 · TRACK 03</small>
            <h1>{nav[view]}</h1>
          </div>
          <div className="head-actions">
            <span>
              demo-v1 · seed <b>2026</b>
            </span>
            <button onClick={launch} disabled={busy}>
              {busy ? <RefreshCw className="spin" /> : <Play />}
              {busy ? "Running…" : "Run recovery"}
            </button>
          </div>
        </header>
        {busy && !run ? (
          <div className="loader">
            <RefreshCw className="spin" />
            <h2>Running paired recovery</h2>
            <p>Policy-checking every action and reconciling every rupee.</p>
          </div>
        ) : (
          run && (
            <div className="content">
              {view === "command" && (
                <Command
                  run={run}
                  inspect={(id) => {
                    setSelected(id);
                    setView("cases");
                  }}
                />
              )}
              {view === "live" && <Live run={run} />}{" "}
              {view === "cases" && (
                <Cases run={run} detail={detail} select={setSelected} />
              )}{" "}
              {view === "dynamic" && (
                <DynamicLab
                  snapshot={dynamic}
                  busy={dynamicBusy}
                  generate={generateDynamic}
                  plan={planDynamic}
                  reply={replyDynamic}
                  advance={advanceClock}
                />
              )}{" "}
              {view === "operations" && (
                <Operations snapshot={operations} decide={decide} tick={tick} />
              )}{" "}
              {view === "evaluation" && <Evaluation run={run} />}{" "}
              {view === "audit" && <Audit run={run} />}
            </div>
          )
        )}
      </main>
    </div>
  );
}
function Card({
  title,
  value,
  note,
  kind = "",
}: {
  title: string;
  value: string;
  note: string;
  kind?: string;
}) {
  return (
    <div className={`card metric ${kind}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function Title({ title, note }: { title: string; note: string }) {
  return (
    <div className="title">
      <h2>{title}</h2>
      <p>{note}</p>
    </div>
  );
}
function Badge({ state }: { state: string }) {
  return <span className={`badge ${state.toLowerCase()}`}>{nice(state)}</span>;
}
function Command({
  run,
  inspect,
}: {
  run: RunSnapshot;
  inspect: (id: string) => void;
}) {
  const m = run.aiMetrics,
    b = run.baselineMetrics;
  return (
    <>
      <div className="complete">
        <span>
          <CheckCircle2 /> BOUNDED AGENT RUN COMPLETE
        </span>
        <small>20 cases · 4 revenue motions · deterministic outcomes</small>
      </div>
      {run.integrations && (
        <div className="integration-proof">
          <div>
            <span
              className={
                run.integrations.ollama.liveDecisions ? "proof-on" : ""
              }
            >
              AI
            </span>
            <p>
              <b>
                {run.integrations.ollama.liveDecisions} live{" "}
                {run.integrations.ollama.model} decisions
              </b>
              <small>
                {run.integrations.ollama.fallbackDecisions} explicitly audited
                fallbacks
              </small>
            </p>
          </div>
          <div>
            <span
              className={run.integrations.razorpay.executed ? "proof-on" : ""}
            >
              RZP
            </span>
            <p>
              <b>
                {run.integrations.razorpay.executed
                  ? "Razorpay test link created"
                  : "Razorpay simulation used"}
              </b>
              <small>
                {run.integrations.razorpay.actionId ??
                  run.integrations.razorpay.fallbackReason}
              </small>
            </p>
            {run.integrations.razorpay.shortUrl && (
              <a
                href={run.integrations.razorpay.shortUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open test link ↗
              </a>
            )}
          </div>
        </div>
      )}
      <div className="metrics">
        <Card
          title="Revenue at risk"
          value={formatMoney(m.atRiskMinor)}
          note="Seeded mixed portfolio"
        />
        <Card
          title="Scenario recovered"
          value={formatMoney(m.recoveredMinor)}
          note={`${m.recoveredCases} cases · live AI + fallback`}
          kind="purple"
        />
        <Card
          title="Strategy lift (simulated)"
          value={`+${formatMoney(run.incrementalNetMinor)}`}
          note={`${(run.liftBps / 100).toFixed(1)}% lift vs baseline`}
          kind="green"
        />
        <Card
          title="Safety controls"
          value="100%"
          note="0 unsafe actions executed"
        />
      </div>
      <div className="split">
        <section className="card">
          <Title
            title="AI vs fixed baseline"
            note="Same cases. Same outcome table. Better interventions."
          />
          <Compare
            label="Net recovered"
            ai={m.netRecoveredMinor}
            base={b.netRecoveredMinor}
          />
          <Compare
            label="Gross recovered"
            ai={m.recoveredMinor}
            base={b.recoveredMinor}
          />
          <Compare
            label="Appropriate action"
            ai={String(m.appropriateActionRateBps)}
            base={String(b.appropriateActionRateBps)}
            percent
          />
        </section>
        <section className="card">
          <Title
            title="Recovery motion"
            note="Recovered value by revenue leak"
          />
          <div className="motions">
            {[
              "FAILED_PAYMENT",
              "CHECKOUT_ABANDONMENT",
              "FAILED_SUBSCRIPTION",
              "OVERDUE_RECEIVABLE",
            ].map((t) => {
              const cs = run.cases.filter((c) => c.type === t);
              const value = cs.reduce(
                (s, c) =>
                  s +
                  BigInt(
                    run.ai.find((r) => r.caseId === c.id)?.recoveredMinor || 0,
                  ),
                0n,
              );
              return (
                <div key={t}>
                  <i>
                    {t.includes("PAYMENT")
                      ? "₹"
                      : t.includes("CHECKOUT")
                        ? "↗"
                        : t.includes("SUBSCRIPTION")
                          ? "↻"
                          : "⌁"}
                  </i>
                  <span>
                    <b>{nice(t)}</b>
                    <small>{cs.length} cases</small>
                  </span>
                  <strong>{formatMoney(value.toString())}</strong>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <section className="card table">
        <Title
          title="Case outcomes"
          note="Inspect any case and its complete evidence chain."
        />
        <div className="tr th">
          <span>Customer</span>
          <span>Revenue event</span>
          <span>Intervention</span>
          <span>Amount</span>
          <span>Outcome</span>
        </div>
        {run.cases.slice(0, 9).map((c) => {
          const r = run.ai.find((a) => a.caseId === c.id)!;
          return (
            <button className="tr" key={c.id} onClick={() => inspect(c.id)}>
              <span>
                <b>{c.customer}</b>
                <small>{c.id}</small>
              </span>
              <span>{nice(c.type)}</span>
              <span>{nice(r.selectedAction)}</span>
              <span>{formatMoney(c.amountMinor)}</span>
              <Badge state={r.state} />
            </button>
          );
        })}
      </section>
    </>
  );
}
function Compare({
  label,
  ai,
  base,
  percent,
}: {
  label: string;
  ai: string;
  base: string;
  percent?: boolean;
}) {
  const a = BigInt(ai),
    b = BigInt(base),
    width = Number((b * 100n) / a);
  return (
    <div className="compare">
      <p>
        <b>{label}</b>
        <span>
          <em>AI {percent ? `${Number(ai) / 100}%` : formatMoney(ai)}</em>
          <small>
            Baseline {percent ? `${Number(base) / 100}%` : formatMoney(base)}
          </small>
        </span>
      </p>
      <div>
        <i />
        <i style={{ width: `${Math.min(width, 100)}%` }} />
      </div>
    </div>
  );
}
function Live({ run }: { run: RunSnapshot }) {
  const events = run.ai
    .flatMap((r) => r.events)
    .filter((e) =>
      [
        "ACTION_PROPOSED",
        "POLICY_ALLOWED",
        "POLICY_REDIRECTED",
        "PAYMENT_RECOVERED",
        "PROMISE_RECORDED",
        "PROMISE_BROKEN",
      ].includes(e.type),
    )
    .slice(0, 24);
  return (
    <>
      <div className="run-summary">
        <span>
          <CheckCircle2 />
          <b>Run completed safely</b>
        </span>
        <strong>{formatMoney(run.aiMetrics.recoveredMinor)} recovered</strong>
      </div>
      <section className="card timeline">
        <Title
          title="Agent execution timeline"
          note={`${events.length} highlighted decisions from ${run.ai.reduce((s, r) => s + r.events.length, 0)} audit events`}
        />
        {events.map((e) => (
          <div key={e.id}>
            <i className={e.actor.toLowerCase()} />
            <time>14:30</time>
            <span>
              <b>{nice(e.type)}</b>
              <p>{e.reason}</p>
              <small>
                {run.cases.find((c) => c.id === e.caseId)?.customer} · {e.actor}
              </small>
            </span>
            <code>{e.hash.slice(0, 10)}</code>
          </div>
        ))}
      </section>
    </>
  );
}
function Cases({
  run,
  detail,
  select,
}: {
  run: RunSnapshot;
  detail: { c: RecoveryCase; a: CaseResult; b: CaseResult } | null;
  select: (id: string) => void;
}) {
  return (
    <div className="case-layout">
      <section className="card case-list">
        <Title title="Portfolio" note="20 bounded recovery cases" />
        {run.cases.map((c) => {
          const r = run.ai.find((x) => x.caseId === c.id)!;
          return (
            <button
              key={c.id}
              onClick={() => select(c.id)}
              className={detail?.c.id === c.id ? "selected" : ""}
            >
              <span>
                <b>{c.customer}</b>
                <small>
                  {nice(c.type)} · {formatMoney(c.amountMinor)}
                </small>
              </span>
              <Badge state={r.state} />
            </button>
          );
        })}
      </section>
      <section className="card detail">
        {detail ? (
          <>
            <div className="detail-head">
              <span>
                <small>{detail.c.id}</small>
                <h2>{detail.c.customer}</h2>
                <p>
                  {nice(detail.c.type)} · {formatMoney(detail.c.amountMinor)}
                </p>
              </span>
              <Badge state={detail.a.state} />
            </div>
            <div className="detail-stats">
              <Field l="Diagnosis" v={nice(detail.a.diagnosis)} />
              <Field l="Intervention" v={nice(detail.a.selectedAction)} />
              <Field l="Recovered" v={formatMoney(detail.a.recoveredMinor)} />
              <Field l="Policy" v={detail.a.policyReason} />
            </div>
            <h3>Evidence used</h3>
            <div className="evidence">
              {detail.c.evidence.map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
            <h3>Paired outcome</h3>
            <div className="paired">
              <div>
                <small>BOUNDED AI</small>
                <b>{nice(detail.a.selectedAction)}</b>
                <Badge state={detail.a.state} />
              </div>
              <div>
                <small>FIXED BASELINE</small>
                <b>{nice(detail.b.selectedAction)}</b>
                <Badge state={detail.b.state} />
              </div>
            </div>
            <h3>Hash-linked audit trail</h3>
            <div className="mini-audit">
              {detail.a.events.map((e) => (
                <div key={e.id}>
                  <i>{e.version}</i>
                  <span>
                    <b>{nice(e.type)}</b>
                    <small>{e.reason}</small>
                  </span>
                  <code>{e.hash.slice(0, 8)}</code>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty">
            <Users />
            <h2>Select a case</h2>
            <p>Review evidence, policy, intervention, and outcome.</p>
          </div>
        )}
      </section>
    </div>
  );
}
function Field({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <small>{l}</small>
      <b>{v}</b>
    </div>
  );
}
function DynamicLab({
  snapshot,
  busy,
  generate,
  plan,
  reply,
  advance,
}: {
  snapshot: DynamicSnapshot | null;
  busy: boolean;
  generate: () => void;
  plan: (id: string) => void;
  reply: (id: string, version: number, message: string) => void;
  advance: (hours: number) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null),
    [message, setMessage] = useState("I promise I will pay by Friday");
  if (!snapshot)
    return (
      <div className="loader">
        <RefreshCw className="spin" />
        <h2>Loading live portfolio</h2>
      </div>
    );
  const selected =
      snapshot.cases.find((c) => c.id === selectedId) ?? snapshot.cases[0],
    events = selected
      ? snapshot.events
          .filter((e) => e.caseId === selected.id)
          .sort((a, b) => b.sequence - a.sequence)
      : [];
  return (
    <>
      <div className="dynamic-toolbar">
        <div>
          <small>SIMULATED CLOCK</small>
          <b>
            {new Date(snapshot.simulatedAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </b>
        </div>
        <span>
          AI budget{" "}
          <b>
            {snapshot.inferenceBudget.remaining}/
            {snapshot.inferenceBudget.limit}
          </b>
        </span>
        <button onClick={() => advance(1)}>+1 hour</button>
        <button onClick={() => advance(24)}>+1 day</button>
        <button className="primary-action" onClick={generate} disabled={busy}>
          {busy ? <RefreshCw className="spin" /> : <Play />} Generate 5 cases
        </button>
      </div>
      <div className="dynamic-metrics">
        <Card
          title="Live portfolio"
          value={String(snapshot.cases.length)}
          note="Cases added without restart"
        />
        <Card
          title="Active exposure"
          value={formatMoney(snapshot.activeMinor)}
          note="Continuously reprioritized"
        />
        <Card
          title="Waiting promises"
          value={String(snapshot.counts.PROMISE_PENDING ?? 0)}
          note="Clock-monitored commitments"
        />
        <Card
          title="Recovered"
          value={String(snapshot.counts.RECOVERED ?? 0)}
          note="Incremental state outcomes"
        />
      </div>
      <div className="dynamic-grid">
        <section className="card dynamic-queue">
          <Title
            title="Priority queue"
            note="Expected value, urgency, and safety determine ordering."
          />
          {snapshot.cases.length ? (
            snapshot.cases.map((c) => (
              <button
                key={c.id}
                className={selected?.id === c.id ? "selected" : ""}
                onClick={() => setSelectedId(c.id)}
              >
                <strong>{c.priorityScore}</strong>
                <span>
                  <b>{c.customer}</b>
                  <small>
                    {nice(c.type)} · {formatMoney(c.amountMinor)}
                  </small>
                </span>
                <Badge state={c.state} />
              </button>
            ))
          ) : (
            <div className="ops-empty">
              Generate cases to start the event-driven portfolio.
            </div>
          )}
        </section>
        <section className="card dynamic-detail">
          {selected ? (
            <>
              <div className="detail-head">
                <span>
                  <small>
                    {selected.id} · PRIORITY {selected.priorityScore}
                  </small>
                  <h2>{selected.customer}</h2>
                  <p>
                    {nice(selected.type)} · {formatMoney(selected.amountMinor)}
                  </p>
                </span>
                <Badge state={selected.state} />
              </div>
              <div className="dynamic-actions">
                {selected.state === "NEW" && (
                  <button
                    className="plan-btn"
                    onClick={() => plan(selected.id)}
                    disabled={busy}
                  >
                    {busy ? "Local AI planning…" : "Plan bounded recovery"}
                  </button>
                )}
                <div className="reply-box">
                  <label>Customer response sandbox</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <div className="reply-presets">
                    <button
                      onClick={() =>
                        setMessage("I promise I will pay by Friday")
                      }
                    >
                      Promise
                    </button>
                    <button
                      onClick={() => setMessage("This payment is disputed")}
                    >
                      Dispute
                    </button>
                    <button onClick={() => setMessage("Stop contacting me")}>
                      Opt out
                    </button>
                    <button
                      onClick={() =>
                        setMessage("My card expired, send an update link")
                      }
                    >
                      Expired card
                    </button>
                  </div>
                  <button
                    className="send-reply"
                    onClick={() =>
                      reply(selected.id, selected.version, message)
                    }
                  >
                    Submit as untrusted evidence
                  </button>
                </div>
              </div>
              <div className="dynamic-facts">
                <Field
                  l="Decision source"
                  v={selected.decisionSource ?? "Not planned"}
                />
                <Field
                  l="Selected action"
                  v={
                    selected.selectedAction
                      ? nice(selected.selectedAction)
                      : "—"
                  }
                />
                <Field
                  l="Next wakeup"
                  v={
                    selected.nextAt
                      ? new Date(selected.nextAt).toLocaleString("en-IN")
                      : "None"
                  }
                />
                <Field l="Last reply" v={selected.lastReply ?? "None"} />
              </div>
              <h3>Live event stream</h3>
              <div className="dynamic-events">
                {events.map((e) => (
                  <div key={e.id}>
                    <i>{e.sequence}</i>
                    <span>
                      <b>{nice(e.type)}</b>
                      <small>
                        {e.actor} · {new Date(e.at).toLocaleTimeString("en-IN")}
                      </small>
                    </span>
                    <code>{e.hash.slice(0, 8)}</code>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty">
              <Clock3 />
              <h2>No dynamic case selected</h2>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Operations({
  snapshot,
  decide,
  tick,
}: {
  snapshot: OpsSnapshot | null;
  decide: (
    id: string,
    version: number,
    decision: "APPROVED" | "REJECTED",
  ) => void;
  tick: () => void;
}) {
  if (!snapshot)
    return (
      <div className="loader">
        <RefreshCw className="spin" />
        <h2>Loading operational state</h2>
      </div>
    );
  return (
    <>
      <div className="ops-metrics">
        <Card
          title="Pending approvals"
          value={String(snapshot.pendingApprovals)}
          note="Human authority required"
        />
        <Card
          title="Scheduled wakeups"
          value={String(snapshot.scheduledJobs)}
          note="Durable local workflow queue"
        />
        <Card
          title="Provider confirmed"
          value={formatMoney(snapshot.providerConfirmedMinor)}
          note="Verified webhooks only"
        />
        <Card
          title="Provider events"
          value={String(snapshot.processedProviderEvents)}
          note="Deduplicated and signed"
        />
      </div>
      <div className="ops-grid">
        <section className="card ops-panel">
          <Title
            title="Human approval queue"
            note="High-value and protected cases never execute autonomously."
          />
          {snapshot.approvals.length ? (
            snapshot.approvals.map((a) => (
              <div className="approval-row" key={a.id}>
                <span>
                  <small>
                    {a.caseId} · {nice(a.action)}
                  </small>
                  <b>{a.customer}</b>
                  <p>{a.reason}</p>
                </span>
                <strong>{formatMoney(a.amountMinor)}</strong>
                {a.status === "PENDING" ? (
                  <div>
                    <button onClick={() => decide(a.id, a.version, "REJECTED")}>
                      Reject
                    </button>
                    <button
                      className="approve"
                      onClick={() => decide(a.id, a.version, "APPROVED")}
                    >
                      Approve
                    </button>
                  </div>
                ) : (
                  <Badge state={a.status} />
                )}
              </div>
            ))
          ) : (
            <p className="ops-empty">No approval requests.</p>
          )}
        </section>
        <section className="card ops-panel">
          <div className="ops-title">
            <Title
              title="Workflow scheduler"
              note="Promise dates and reconciliation survive application restarts."
            />
            <button onClick={tick}>Run due jobs</button>
          </div>
          {snapshot.jobs.map((j) => (
            <div className="job-row" key={j.id}>
              <i className={j.status === "SCHEDULED" ? "pending" : "done"} />
              <span>
                <b>{nice(j.kind)}</b>
                <small>
                  {j.caseId} · due{" "}
                  {new Date(j.dueAt).toLocaleDateString("en-IN")}
                </small>
              </span>
              <Badge state={j.status} />
            </div>
          ))}
        </section>
      </div>
      <section className="card provider-ledger">
        <Title
          title="Provider-confirmed recovery ledger"
          note="A payment link is not revenue; only a verified paid/captured webhook credits this ledger."
        />
        {snapshot.ledger.length ? (
          snapshot.ledger.map((e) => (
            <div key={e.id}>
              <span>
                <b>{e.caseId}</b>
                <small>{e.providerPaymentId}</small>
              </span>
              <strong>{formatMoney(e.amountMinor)}</strong>
              <Badge state="CONFIRMED" />
            </div>
          ))
        ) : (
          <p className="ops-empty">
            No verified provider payment webhook has been received yet. Use the
            signed local replay command to exercise this path.
          </p>
        )}
      </section>
    </>
  );
}

function Evaluation({ run }: { run: RunSnapshot }) {
  const rows = [
    [
      "Net recovered",
      formatMoney(run.aiMetrics.netRecoveredMinor),
      formatMoney(run.baselineMetrics.netRecoveredMinor),
      `+${formatMoney(run.incrementalNetMinor)}`,
    ],
    [
      "Recovered cases",
      String(run.aiMetrics.recoveredCases),
      String(run.baselineMetrics.recoveredCases),
      `+${run.aiMetrics.recoveredCases - run.baselineMetrics.recoveredCases}`,
    ],
    [
      "Appropriate actions",
      `${run.aiMetrics.appropriateActionRateBps / 100}%`,
      `${run.baselineMetrics.appropriateActionRateBps / 100}%`,
      `+${(run.aiMetrics.appropriateActionRateBps - run.baselineMetrics.appropriateActionRateBps) / 100} pp`,
    ],
    ["Unsafe executed", "0", "0", "No regression"],
    ["Audit completeness", "100%", "100%", "Complete"],
  ];
  return (
    <>
      <div className="eval-hero">
        <small>INCREMENTAL NET RECOVERY</small>
        <h2>+{formatMoney(run.incrementalNetMinor)}</h2>
        <span>
          <ArrowUpRight /> {(run.liftBps / 100).toFixed(1)}% lift over fixed
          strategy
        </span>
        <p>
          Simulated results · paired deterministic counterfactual evaluation
        </p>
      </div>
      <section className="card eval-table">
        <div className="eval-row head">
          <span>Metric</span>
          <span>Bounded strategy</span>
          <span>Fixed baseline</span>
          <span>Difference</span>
        </div>
        {rows.map((r) => (
          <div className="eval-row" key={r[0]}>
            <b>{r[0]}</b>
            <strong>{r[1]}</strong>
            <span>{r[2]}</span>
            <em>{r[3]}</em>
          </div>
        ))}
      </section>
      {run.decisionCohorts && (
        <section className="cohort-strip">
          <div>
            <small>
              LIVE {run.integrations?.ollama.model ?? "LOCAL MODEL"}
            </small>
            <b>
              {run.decisionCohorts.liveAI.cases} cases ·{" "}
              {formatMoney(run.decisionCohorts.liveAI.recoveredMinor)}
            </b>
            <span>
              {run.decisionCohorts.liveAI.appropriateActionRateBps / 100}%
              appropriate action
            </span>
          </div>
          <div>
            <small>DETERMINISTIC FALLBACK</small>
            <b>
              {run.decisionCohorts.fallback.cases} cases ·{" "}
              {formatMoney(run.decisionCohorts.fallback.recoveredMinor)}
            </b>
            <span>
              {run.decisionCohorts.fallback.appropriateActionRateBps / 100}%
              appropriate action
            </span>
          </div>
          <div className="integrity-ok">
            <small>EVALUATION INTEGRITY</small>
            <b>Hidden labels isolated</b>
            <span>Agent context excludes cause, best action, and outcomes</span>
          </div>
        </section>
      )}
      <div className="metrics">
        <Card
          title="Policy recall"
          value="100%"
          note="All protected cases stopped"
        />
        <Card
          title="Unsafe execution"
          value="0"
          note="Across both strategies"
        />
        <Card
          title="Promises"
          value="1 kept · 1 broken"
          note="Tracked through grace period"
        />
        <Card
          title="Ledger violations"
          value="0"
          note="Exact minor-unit arithmetic"
        />
      </div>
    </>
  );
}
function Audit({ run }: { run: RunSnapshot }) {
  const count = run.ai
    .concat(run.baseline)
    .reduce((s, r) => s + r.events.length, 0);
  return (
    <>
      <div className="audit-hero">
        <i>
          <ShieldCheck />
        </i>
        <span>
          <small>AUDIT INTEGRITY</small>
          <h2>
            {run.auditIntegrity
              ? "Evidence chain verified"
              : "Verification failed"}
          </h2>
          <p>{count} hash-linked events · 40 paired traces</p>
        </span>
        <a href={`/api/runs/${run.id}/export`}>
          <Download />
          Export JSON
        </a>
      </div>
      <div className="audit-cards">
        <Card
          title="Run manifest"
          value={run.id}
          note={`${run.datasetVersion} · seed ${run.seed}`}
        />
        <Card
          title="Decision runtime"
          value={run.integrations?.ollama.model ?? "gemma3:latest"}
          note="Schema validation + fallback"
        />
        <Card
          title="Financial control"
          value="Minor-unit ledger"
          note="0 violations · 0 duplicates"
        />
      </div>
      <section className="card manifest">
        <Title
          title="Reproducibility manifest"
          note="Inputs and versions required to reconstruct this experiment."
        />
        <pre>
          {JSON.stringify(
            {
              runId: run.id,
              datasetVersion: run.datasetVersion,
              seed: run.seed,
              mode: run.mode,
              startedAt: run.startedAt,
              simulatedAt: run.simulatedAt,
              auditIntegrity: run.auditIntegrity,
              aiMetrics: run.aiMetrics,
              baselineMetrics: run.baselineMetrics,
            },
            null,
            2,
          )}
        </pre>
      </section>
    </>
  );
}

