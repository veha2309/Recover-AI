import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import { demoDataset } from "./dataset";
import { ActionType, RecoveryCase, asMinor, minor } from "./domain";
import { getDatabase } from "./store";

export type DynamicState =
  | "NEW"
  | "PLANNING"
  | "ACTION_SCHEDULED"
  | "WAITING_FOR_OUTCOME"
  | "WAITING_PROVIDER"
  | "PROMISE_PENDING"
  | "RECOVERED"
  | "ESCALATED"
  | "CLOSED"
  | "ABSTAINED";
export interface DynamicCase {
  id: string;
  sourceCaseId: string;
  customer: string;
  type: string;
  amountMinor: string;
  currency: string;
  state: DynamicState;
  priorityScore: number;
  version: number;
  decisionSource?: "OLLAMA" | "FALLBACK";
  selectedAction?: ActionType;
  diagnosis?: string;
  nextAt?: string;
  promiseDueAt?: string;
  lastReply?: string;
  createdAt: string;
  updatedAt: string;
}
export interface DynamicEvent {
  id: string;
  caseId: string;
  sequence: number;
  type: string;
  actor: string;
  at: string;
  payload: Record<string, unknown>;
  previousHash: string;
  hash: string;
}
export interface DynamicSnapshot {
  simulatedAt: string;
  cases: DynamicCase[];
  events: DynamicEvent[];
  counts: Record<string, number>;
  atRiskMinor: string;
  activeMinor: string;
  inferenceBudget: { limit: number; used: number; remaining: number };
}

const replySchema = z
  .object({
    message: z.string().trim().min(2).max(500),
    expectedVersion: z.number().int().positive(),
  })
  .strict();
function db() {
  const value = getDatabase();
  value.exec(
    `CREATE TABLE IF NOT EXISTS dynamic_config (key TEXT PRIMARY KEY,value TEXT NOT NULL);CREATE TABLE IF NOT EXISTS dynamic_cases (id TEXT PRIMARY KEY,source_case_id TEXT NOT NULL,customer TEXT NOT NULL,type TEXT NOT NULL,amount_minor TEXT NOT NULL,currency TEXT NOT NULL,state TEXT NOT NULL,priority_score INTEGER NOT NULL,version INTEGER NOT NULL,decision_source TEXT,selected_action TEXT,diagnosis TEXT,next_at TEXT,promise_due_at TEXT,last_reply TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,payload_json TEXT NOT NULL);CREATE TABLE IF NOT EXISTS dynamic_events (id TEXT PRIMARY KEY,case_id TEXT NOT NULL,sequence INTEGER NOT NULL,type TEXT NOT NULL,actor TEXT NOT NULL,at TEXT NOT NULL,payload_json TEXT NOT NULL,previous_hash TEXT NOT NULL,hash TEXT NOT NULL,UNIQUE(case_id,sequence));`,
  );
  value
    .prepare(
      "INSERT OR IGNORE INTO dynamic_config VALUES ('simulated_at','2026-08-24T10:00:00.000Z')",
    )
    .run();
  value
    .prepare(
      "INSERT OR IGNORE INTO dynamic_config VALUES ('inference_limit','6')",
    )
    .run();
  value
    .prepare(
      "INSERT OR IGNORE INTO dynamic_config VALUES ('inference_used','0')",
    )
    .run();
  return value;
}
const clock = () =>
  String(
    (
      db()
        .prepare("SELECT value FROM dynamic_config WHERE key='simulated_at'")
        .get() as { value: string }
    ).value,
  );
const configNumber = (key: string) =>
  Number(
    (
      db().prepare("SELECT value FROM dynamic_config WHERE key=?").get(key) as {
        value: string;
      }
    ).value,
  );
const addHours = (iso: string, hours: number) =>
  new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
const hash = (value: unknown) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
function priority(item: RecoveryCase) {
  const value = Math.min(Number(minor(item.amountMinor) / 10000n), 5000),
    urgency =
      item.type === "OVERDUE_RECEIVABLE"
        ? 900
        : item.type === "FAILED_SUBSCRIPTION"
          ? 700
          : item.type === "FAILED_PAYMENT"
            ? 600
            : 450,
    risk =
      item.flags.disputed || item.flags.fraud || item.flags.manualHold
        ? 1200
        : 0;
  return Math.round(value + urgency + risk);
}
function append(
  caseId: string,
  type: string,
  actor: string,
  payload: Record<string, unknown> = {},
) {
  const database = db(),
    last = database
      .prepare(
        "SELECT sequence,hash FROM dynamic_events WHERE case_id=? ORDER BY sequence DESC LIMIT 1",
      )
      .get(caseId) as { sequence: number; hash: string } | undefined,
    sequence = (last?.sequence ?? 0) + 1,
    previousHash = last?.hash ?? "GENESIS",
    at = clock(),
    core = { caseId, sequence, type, actor, at, payload, previousHash },
    eventHash = hash(core),
    id = `DE-${caseId}-${sequence}`;
  database
    .prepare("INSERT INTO dynamic_events VALUES (?,?,?,?,?,?,?,?,?)")
    .run(
      id,
      caseId,
      sequence,
      type,
      actor,
      at,
      JSON.stringify(payload),
      previousHash,
      eventHash,
    );
}
const rowToCase = (row: Record<string, unknown>): DynamicCase => ({
  id: String(row.id),
  sourceCaseId: String(row.sourceCaseId),
  customer: String(row.customer),
  type: String(row.type),
  amountMinor: String(row.amountMinor),
  currency: String(row.currency),
  state: String(row.state) as DynamicState,
  priorityScore: Number(row.priorityScore),
  version: Number(row.version),
  decisionSource: row.decisionSource as DynamicCase["decisionSource"],
  selectedAction: row.selectedAction as ActionType | undefined,
  diagnosis: row.diagnosis ? String(row.diagnosis) : undefined,
  nextAt: row.nextAt ? String(row.nextAt) : undefined,
  promiseDueAt: row.promiseDueAt ? String(row.promiseDueAt) : undefined,
  lastReply: row.lastReply ? String(row.lastReply) : undefined,
  createdAt: String(row.createdAt),
  updatedAt: String(row.updatedAt),
});
export function getDynamicCase(id: string) {
  const row = db()
    .prepare(
      "SELECT id,source_case_id sourceCaseId,customer,type,amount_minor amountMinor,currency,state,priority_score priorityScore,version,decision_source decisionSource,selected_action selectedAction,diagnosis,next_at nextAt,promise_due_at promiseDueAt,last_reply lastReply,created_at createdAt,updated_at updatedAt,payload_json payloadJson FROM dynamic_cases WHERE id=?",
    )
    .get(id) as (Record<string, unknown> & { payloadJson: string }) | undefined;
  return row
    ? {
        caseData: rowToCase(row),
        source: JSON.parse(row.payloadJson) as RecoveryCase,
      }
    : null;
}
export function dynamicSnapshot(): DynamicSnapshot {
  const database = db(),
    rows = database
      .prepare(
        "SELECT id,source_case_id sourceCaseId,customer,type,amount_minor amountMinor,currency,state,priority_score priorityScore,version,decision_source decisionSource,selected_action selectedAction,diagnosis,next_at nextAt,promise_due_at promiseDueAt,last_reply lastReply,created_at createdAt,updated_at updatedAt FROM dynamic_cases ORDER BY priority_score DESC,created_at",
      )
      .all() as Record<string, unknown>[],
    cases = rows.map(rowToCase),
    events = (
      database
        .prepare(
          "SELECT id,case_id caseId,sequence,type,actor,at,payload_json payloadJson,previous_hash previousHash,hash FROM dynamic_events ORDER BY at DESC,id DESC LIMIT 80",
        )
        .all() as Array<Record<string, unknown> & { payloadJson: string }>
    ).map((e) => ({
      id: String(e.id),
      caseId: String(e.caseId),
      sequence: Number(e.sequence),
      type: String(e.type),
      actor: String(e.actor),
      at: String(e.at),
      payload: JSON.parse(e.payloadJson),
      previousHash: String(e.previousHash),
      hash: String(e.hash),
    })),
    counts: Record<string, number> = {};
  for (const c of cases) counts[c.state] = (counts[c.state] ?? 0) + 1;
  const active = cases.filter(
    (c) => !["RECOVERED", "CLOSED", "ABSTAINED"].includes(c.state),
  );
  const limit = configNumber("inference_limit"),
    used = configNumber("inference_used");
  return {
    simulatedAt: clock(),
    cases,
    events,
    counts,
    atRiskMinor: asMinor(cases.reduce((s, c) => s + minor(c.amountMinor), 0n)),
    activeMinor: asMinor(active.reduce((s, c) => s + minor(c.amountMinor), 0n)),
    inferenceBudget: { limit, used, remaining: Math.max(0, limit - used) },
  };
}
export function generateDynamicCases(count = 5) {
  const database = db(),
    existing = (
      database.prepare("SELECT COUNT(*) count FROM dynamic_cases").get() as {
        count: number;
      }
    ).count,
    now = clock(),
    sources = demoDataset();
  const insert = database.prepare(
    "INSERT INTO dynamic_cases VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  );
  const tx = database.transaction(() => {
    for (let i = 0; i < Math.min(Math.max(count, 1), 10); i++) {
      const source = sources[(existing + i) % sources.length],
        id = `DYN-${String(existing + i + 1).padStart(3, "0")}`;
      insert.run(
        id,
        source.id,
        source.customer,
        source.type,
        source.amountMinor,
        source.currency,
        "NEW",
        priority(source),
        1,
        null,
        null,
        null,
        null,
        null,
        null,
        now,
        now,
        JSON.stringify(source),
      );
      append(id, "CASE_ARRIVED", "SYSTEM", {
        sourceCaseId: source.id,
        priorityScore: priority(source),
      });
    }
  });
  tx();
  return dynamicSnapshot();
}
export function reserveInference() {
  const database = db(),
    used = configNumber("inference_used"),
    limit = configNumber("inference_limit");
  if (used >= limit) return false;
  database
    .prepare("UPDATE dynamic_config SET value=? WHERE key='inference_used'")
    .run(String(used + 1));
  return true;
}
export function planDynamicCase(
  id: string,
  input: {
    action: ActionType;
    diagnosis: string;
    source: "OLLAMA" | "FALLBACK";
  },
) {
  const current = getDynamicCase(id);
  if (!current) throw new Error("Dynamic case not found");
  if (!["NEW", "PLANNING"].includes(current.caseData.state))
    throw new Error("Case is not ready for planning");
  const now = clock(),
    terminal: [ActionType, DynamicState] | null =
      input.action === "ESCALATE"
        ? [input.action, "ESCALATED"]
        : input.action === "ABSTAIN"
          ? [input.action, "ABSTAINED"]
          : input.action === "CLOSE"
            ? [input.action, "CLOSED"]
            : null,
    state = terminal?.[1] ?? "ACTION_SCHEDULED",
    nextAt = terminal ? null : addHours(now, 2);
  db()
    .prepare(
      "UPDATE dynamic_cases SET state=?,selected_action=?,diagnosis=?,decision_source=?,next_at=?,version=version+1,updated_at=? WHERE id=?",
    )
    .run(state, input.action, input.diagnosis, input.source, nextAt, now, id);
  append(id, "PLAN_AUTHORIZED", "POLICY", {
    action: input.action,
    diagnosis: input.diagnosis,
    decisionSource: input.source,
    nextAt,
  });
  return dynamicSnapshot();
}
export function recordDynamicReply(id: string, input: unknown) {
  const parsed = replySchema.parse(input),
    current = getDynamicCase(id);
  if (!current) throw new Error("Dynamic case not found");
  if (current.caseData.version !== parsed.expectedVersion)
    throw new Error("Case version is stale");
  const text = parsed.message.toLowerCase(),
    now = clock();
  let state: DynamicState = "WAITING_FOR_OUTCOME",
    nextAt: string | null = addHours(now, 24),
    promise: string | null = null,
    event = "CUSTOMER_REPLY_CLASSIFIED";
  if (/stop|unsubscribe|do not contact/.test(text)) {
    state = "CLOSED";
    nextAt = null;
    event = "CUSTOMER_OPT_OUT";
  } else if (/dispute|not mine|fraud/.test(text)) {
    state = "ESCALATED";
    nextAt = null;
    event = "DISPUTE_REPORTED";
  } else if (/friday|monday|promise|will pay|pay by/.test(text)) {
    state = "PROMISE_PENDING";
    promise = addHours(now, 72);
    nextAt = promise;
    event = "PROMISE_RECORDED";
  } else if (/expired|new card|payment method/.test(text)) {
    state = "ACTION_SCHEDULED";
    nextAt = addHours(now, 1);
    event = "PAYMENT_METHOD_UPDATE_REQUESTED";
  } else if (/already paid|i paid/.test(text)) {
    state = "WAITING_PROVIDER";
    nextAt = null;
    event = "PAYMENT_CLAIM_UNVERIFIED";
  }
  db()
    .prepare(
      "UPDATE dynamic_cases SET state=?,next_at=?,promise_due_at=?,last_reply=?,version=version+1,updated_at=? WHERE id=?",
    )
    .run(state, nextAt, promise, parsed.message, now, id);
  append(id, event, "CUSTOMER", { message: parsed.message, state, nextAt });
  return dynamicSnapshot();
}
export function advanceDynamicClock(hours: number) {
  if (!Number.isFinite(hours) || hours < 1 || hours > 720)
    throw new Error("Clock advance must be between 1 and 720 hours");
  const database = db(),
    from = clock(),
    to = addHours(from, hours);
  database
    .prepare("UPDATE dynamic_config SET value=? WHERE key='simulated_at'")
    .run(to);
  const due = database
    .prepare(
      "SELECT id,state,source_case_id sourceCaseId FROM dynamic_cases WHERE next_at IS NOT NULL AND next_at<=? AND state IN ('ACTION_SCHEDULED','WAITING_FOR_OUTCOME','PROMISE_PENDING')",
    )
    .all(to) as { id: string; state: DynamicState; sourceCaseId: string }[];
  for (const item of due) {
    let state: DynamicState,
      nextAt: string | null = null,
      event: string;
    if (item.state === "ACTION_SCHEDULED") {
      state = "WAITING_FOR_OUTCOME";
      nextAt = addHours(to, 2);
      event = "ACTION_EXECUTED_SIMULATION";
    } else if (item.state === "PROMISE_PENDING") {
      state = "ESCALATED";
      event = "PROMISE_GRACE_EXPIRED";
    } else {
      const source = demoDataset().find((c) => c.id === item.sourceCaseId);
      const recoverable =
        source?.outcomes[source.expectedBestAction]?.result === "RECOVERED";
      state = recoverable ? "RECOVERED" : "ESCALATED";
      event = recoverable
        ? "SIMULATED_RECOVERY_CONFIRMED"
        : "OUTCOME_UNRESOLVED";
    }
    database
      .prepare(
        "UPDATE dynamic_cases SET state=?,next_at=?,version=version+1,updated_at=? WHERE id=?",
      )
      .run(state, nextAt, to, item.id);
    append(item.id, event, "CLOCK", { from, to, state });
  }
  return { processed: due.length, snapshot: dynamicSnapshot() };
}
