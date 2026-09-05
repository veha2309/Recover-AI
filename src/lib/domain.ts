import { z } from "zod";

export const caseTypes = [
  "FAILED_PAYMENT",
  "CHECKOUT_ABANDONMENT",
  "FAILED_SUBSCRIPTION",
  "OVERDUE_RECEIVABLE",
] as const;
export const states = [
  "INGESTED",
  "VALIDATING",
  "DIAGNOSING",
  "PLANNING",
  "POLICY_CHECK",
  "ACTION_SCHEDULED",
  "WAITING_FOR_OUTCOME",
  "PROMISE_PENDING",
  "RECOVERED",
  "ABSTAINED",
  "ESCALATED",
  "CLOSED",
] as const;
export const actions = [
  "RETRY_PAYMENT",
  "CREATE_PAYMENT_LINK",
  "REQUEST_PAYMENT_METHOD",
  "SEND_REMINDER",
  "RECORD_PROMISE",
  "WAIT",
  "ESCALATE",
  "ABSTAIN",
  "CLOSE",
] as const;

export type CaseType = (typeof caseTypes)[number];
export type CaseState = (typeof states)[number];
export type ActionType = (typeof actions)[number];
export type Strategy = "AI" | "BASELINE";
export type ExecutionMode = "SIMULATION" | "RAZORPAY_TEST";

export interface RiskFlags {
  optOut?: boolean;
  disputed?: boolean;
  fraud?: boolean;
  manualHold?: boolean;
  ambiguous?: boolean;
}
export interface Outcome {
  result: "RECOVERED" | "PROMISE" | "FAILED" | "NO_RESPONSE";
  afterHours: number;
  response?: string;
  promiseDays?: number;
  promiseKept?: boolean;
}
export interface RecoveryCase {
  id: string;
  customer: string;
  type: CaseType;
  amountMinor: string;
  currency: "INR";
  cause: string;
  evidence: string[];
  flags: RiskFlags;
  eligibleActions: ActionType[];
  outcomes: Partial<Record<ActionType, Outcome>>;
  expectedBestAction: ActionType;
  segment: string;
}
export type AgentCaseContext = Pick<
  RecoveryCase,
  | "id"
  | "customer"
  | "type"
  | "amountMinor"
  | "currency"
  | "evidence"
  | "flags"
  | "eligibleActions"
  | "segment"
>;
export const toAgentContext = (value: RecoveryCase): AgentCaseContext => ({
  id: value.id,
  customer: value.customer,
  type: value.type,
  amountMinor: value.amountMinor,
  currency: value.currency,
  evidence: [...value.evidence],
  flags: { ...value.flags },
  eligibleActions: [...value.eligibleActions],
  segment: value.segment,
});

export interface Decision {
  diagnosisCode: string;
  confidenceBps: number;
  evidenceIds: string[];
  action: ActionType;
  rationale: string;
  abstentionReason?: string;
  model: string;
  promptVersion: string;
  latencyMs: number;
  parseStatus: "VALID" | "REPAIRED" | "FALLBACK";
  fallback: boolean;
}

export interface AuditEvent {
  id: string;
  runId: string;
  caseId: string;
  strategy: Strategy;
  version: number;
  type: string;
  actor: "SYSTEM" | "AGENT" | "POLICY" | "TOOL" | "CUSTOMER";
  at: string;
  reason: string;
  policyVersion: string;
  modelVersion: string;
  datasetVersion: string;
  correlationId: string;
  idempotencyKey: string;
  inputHash: string;
  outputHash: string;
  previousHash: string;
  hash: string;
  payload: Record<string, unknown>;
}

export interface CaseResult {
  caseId: string;
  strategy: Strategy;
  state: CaseState;
  recoveredMinor: string;
  costMinor: string;
  selectedAction: ActionType;
  diagnosis: string;
  policyReason: string;
  actionCount: number;
  modelFallback: boolean;
  promiseStatus?: "KEPT" | "BROKEN" | "PENDING";
  events: AuditEvent[];
  executionMode?: ExecutionMode;
  externalActionId?: string;
  externalActionUrl?: string;
}

export interface Metrics {
  atRiskMinor: string;
  recoveredMinor: string;
  netRecoveredMinor: string;
  interventionCostMinor: string;
  recoveredCases: number;
  recoveryRateBps: number;
  diagnosisAccuracyBps: number;
  appropriateActionRateBps: number;
  safetyRecallBps: number;
  unsafeProposed: number;
  unsafeExecuted: number;
  abstentions: number;
  escalations: number;
  promisesKept: number;
  promisesBroken: number;
  modelFallbacks: number;
  duplicateActions: number;
  auditCompletenessBps: number;
  ledgerViolations: number;
}

export interface RunSnapshot {
  id: string;
  status: "READY" | "RUNNING" | "PAUSED" | "COMPLETED";
  mode: ExecutionMode;
  datasetVersion: string;
  seed: number;
  startedAt: string;
  simulatedAt: string;
  cases: RecoveryCase[];
  ai: CaseResult[];
  baseline: CaseResult[];
  aiMetrics: Metrics;
  baselineMetrics: Metrics;
  incrementalNetMinor: string;
  liftBps: number;
  auditIntegrity: boolean;
  modelAvailable: boolean;
  integrations?: {
    ollama: {
      available: boolean;
      liveDecisions: number;
      fallbackDecisions: number;
      fallbackReasons?: string[];
      model: string;
    };
    razorpay: {
      configured: boolean;
      executed: boolean;
      mode: ExecutionMode;
      actionId?: string;
      shortUrl?: string;
      fallbackReason?: string;
    };
  };
  decisionCohorts?: {
    liveAI: {
      cases: number;
      recoveredMinor: string;
      appropriateActionRateBps: number;
    };
    fallback: {
      cases: number;
      recoveredMinor: string;
      appropriateActionRateBps: number;
    };
    hiddenLabelsExposed: false;
  };
}

export const createRunSchema = z
  .object({
    seed: z.number().int().default(2026),
    mode: z.enum(["SIMULATION", "RAZORPAY_TEST"]).default("SIMULATION"),
  })
  .strict();
export const decisionSchema = z
  .object({
    diagnosisCode: z.string(),
    confidenceBps: z.number().int().min(0).max(10000),
    evidenceIds: z.array(z.string()).min(1),
    action: z.enum(actions),
    rationale: z.string().max(500),
    abstentionReason: z.string().optional(),
  })
  .strict();

export const minor = (value: string | bigint) => BigInt(value);
export const asMinor = (value: bigint) => value.toString();
export const formatMoney = (value: string, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value) / 100);
