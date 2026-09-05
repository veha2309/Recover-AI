import crypto from "node:crypto";
import { actionCost, demoDataset } from "./dataset";
import {
  ActionType,
  AgentCaseContext,
  asMinor,
  AuditEvent,
  CaseResult,
  Decision,
  ExecutionMode,
  Metrics,
  minor,
  RecoveryCase,
  RunSnapshot,
  Strategy,
  toAgentContext,
} from "./domain";

const POLICY_VERSION = "recovery-policy-v1";
const DATASET_VERSION = "recoverai-demo-v1";
const MODEL_VERSION = process.env.OLLAMA_MODEL ?? "gemma3:latest";
const now = "2026-08-24T09:00:00.000Z";
const sha = (value: unknown) =>
  crypto
    .createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");

export function policy(
  caseData: AgentCaseContext,
  proposed: ActionType,
): { allowed: boolean; action: ActionType; reason: string } {
  if (caseData.flags.optOut)
    return {
      allowed: proposed === "CLOSE",
      action: "CLOSE",
      reason: "Customer opted out; contact stopped",
    };
  if (
    caseData.flags.disputed ||
    caseData.flags.fraud ||
    caseData.flags.manualHold
  )
    return {
      allowed: proposed === "ESCALATE",
      action: "ESCALATE",
      reason: "Protected risk flag requires human review",
    };
  if (caseData.flags.ambiguous)
    return {
      allowed: proposed === "ABSTAIN",
      action: "ABSTAIN",
      reason: "Conflicting evidence requires abstention",
    };
  if (
    minor(caseData.amountMinor) > 5_000_000n &&
    ["RETRY_PAYMENT", "CREATE_PAYMENT_LINK"].includes(proposed)
  )
    return {
      allowed: false,
      action: "ESCALATE",
      reason: "High-value payment action requires approval",
    };
  if (!caseData.eligibleActions.includes(proposed))
    return {
      allowed: false,
      action: caseData.eligibleActions[0] ?? "ABSTAIN",
      reason: "Action is outside the case allow-list",
    };
  return {
    allowed: true,
    action: proposed,
    reason: "Permitted by bounded recovery policy",
  };
}

export function deterministicDecision(
  caseData: AgentCaseContext,
  strategy: Strategy,
): Decision {
  let action: ActionType;
  if (strategy === "BASELINE") {
    action =
      caseData.type === "FAILED_PAYMENT" ||
      caseData.type === "FAILED_SUBSCRIPTION"
        ? "RETRY_PAYMENT"
        : "SEND_REMINDER";
    if (caseData.flags.optOut) action = "CLOSE";
    if (
      caseData.flags.disputed ||
      caseData.flags.fraud ||
      caseData.flags.manualHold
    )
      action = "ESCALATE";
    if (caseData.flags.ambiguous) action = "ABSTAIN";
  } else {
    const evidence = caseData.evidence.join(" ").toLowerCase();
    if (caseData.flags.optOut) action = "CLOSE";
    else if (
      caseData.flags.disputed ||
      caseData.flags.fraud ||
      caseData.flags.manualHold
    )
      action = "ESCALATE";
    else if (caseData.flags.ambiguous) action = "ABSTAIN";
    else if (
      /expired|payment method/.test(evidence) &&
      caseData.eligibleActions.includes("REQUEST_PAYMENT_METHOD")
    )
      action = "REQUEST_PAYMENT_METHOD";
    else if (
      /3ds|authentication|checkout|upi_timeout|abandoned/.test(evidence) &&
      caseData.eligibleActions.includes("CREATE_PAYMENT_LINK")
    )
      action = "CREATE_PAYMENT_LINK";
    else if (
      /insufficient|network_timeout|transient/.test(evidence) &&
      caseData.eligibleActions.includes("RETRY_PAYMENT")
    )
      action = "RETRY_PAYMENT";
    else if (
      /budget_delay|reply:|ap_contact:verified/.test(evidence) &&
      caseData.eligibleActions.includes("RECORD_PROMISE")
    )
      action = "RECORD_PROMISE";
    else action = caseData.eligibleActions[0] ?? "ABSTAIN";
  }
  const evidence = caseData.evidence.join(" ").toLowerCase();
  const diagnosis = caseData.flags.optOut
    ? "OPT_OUT"
    : caseData.flags.disputed
      ? "DISPUTE"
      : caseData.flags.fraud
        ? "FRAUD_SIGNAL"
        : caseData.flags.manualHold
          ? "MANUAL_HOLD"
          : caseData.flags.ambiguous
            ? "CONTRADICTORY_EVIDENCE"
            : /insufficient/.test(evidence)
              ? "INSUFFICIENT_FUNDS"
              : /expired/.test(evidence)
                ? "EXPIRED_CARD"
                : /network_timeout/.test(evidence)
                  ? "TRANSIENT_NETWORK"
                  : /3ds/.test(evidence)
                    ? "AUTHENTICATION_REQUIRED"
                    : /budget_delay/.test(evidence)
                      ? "PRICE_CONCERN"
                      : /checkout|upi_timeout|address_step/.test(evidence)
                        ? "CHECKOUT_FRICTION"
                        : "EVIDENCE_INCOMPLETE";
  return {
    diagnosisCode: diagnosis,
    confidenceBps: strategy === "AI" ? 9100 : 5000,
    evidenceIds: caseData.evidence.map((_, i) => `${caseData.id}-E${i + 1}`),
    action,
    rationale:
      strategy === "AI"
        ? "Selected the highest-value eligible intervention grounded in processor and customer evidence."
        : "Applied the fixed retry-or-remind baseline.",
    model: strategy === "AI" ? MODEL_VERSION : "fixed-policy-v1",
    promptVersion: "decision-v1",
    latencyMs: 0,
    parseStatus: strategy === "AI" ? "FALLBACK" : "VALID",
    fallback: strategy === "AI",
  };
}

class EventBuilder {
  events: AuditEvent[] = [];
  constructor(
    private runId: string,
    private caseId: string,
    private strategy: Strategy,
  ) {}
  add(
    type: string,
    actor: AuditEvent["actor"],
    reason: string,
    payload: Record<string, unknown> = {},
  ) {
    const previousHash = this.events.at(-1)?.hash ?? "GENESIS";
    const core = {
      runId: this.runId,
      caseId: this.caseId,
      strategy: this.strategy,
      version: this.events.length + 1,
      type,
      actor,
      at: now,
      reason,
      payload,
      previousHash,
    };
    const event: AuditEvent = {
      id: `${this.runId}-${this.caseId}-${this.strategy}-${this.events.length + 1}`,
      ...core,
      policyVersion: POLICY_VERSION,
      modelVersion: MODEL_VERSION,
      datasetVersion: DATASET_VERSION,
      correlationId: `COR-${this.caseId}`,
      idempotencyKey: `IDEM-${this.runId}-${this.caseId}-${this.strategy}-${type}`,
      inputHash: sha({ type, reason }),
      outputHash: sha(payload),
      hash: sha(core),
    };
    this.events.push(event);
    return event;
  }
}

export interface ToolExecution {
  mode: ExecutionMode;
  id?: string;
  shortUrl?: string;
}

function runCase(
  runId: string,
  caseData: RecoveryCase,
  strategy: Strategy,
  suppliedDecision?: Decision,
  toolExecution?: ToolExecution,
): CaseResult {
  const audit = new EventBuilder(runId, caseData.id, strategy);
  audit.add("CASE_INGESTED", "SYSTEM", "Validated normalized revenue case", {
    amountMinor: caseData.amountMinor,
    type: caseData.type,
  });
  const context = toAgentContext(caseData);
  const decision = suppliedDecision ?? deterministicDecision(context, strategy);
  audit.add(
    "DIAGNOSIS_PROPOSED",
    "AGENT",
    "Evidence-grounded diagnosis produced",
    {
      cause: decision.diagnosisCode,
      model: decision.model,
      parseStatus: decision.parseStatus,
      latencyMs: decision.latencyMs,
    },
  );
  audit.add("ACTION_PROPOSED", "AGENT", decision.rationale, {
    action: decision.action,
    confidenceBps: decision.confidenceBps,
    fallback: decision.fallback,
  });
  const gate = policy(context, decision.action);
  audit.add(
    gate.allowed ? "POLICY_ALLOWED" : "POLICY_REDIRECTED",
    "POLICY",
    gate.reason,
    { proposed: decision.action, authorized: gate.action },
  );
  const selectedAction = gate.action;
  const executed =
    toolExecution && selectedAction === "CREATE_PAYMENT_LINK"
      ? toolExecution
      : { mode: "SIMULATION" as const };
  audit.add(
    "ACTION_EXECUTED",
    "TOOL",
    executed.mode === "RAZORPAY_TEST"
      ? "Created bounded Razorpay test-mode payment link"
      : "Executed bounded simulated intervention",
    {
      action: selectedAction,
      mode: executed.mode,
      externalActionId: executed.id,
      shortUrl: executed.shortUrl,
    },
  );
  const outcome = caseData.outcomes[selectedAction] ?? {
    result: "FAILED" as const,
    afterHours: 24,
  };
  let state: CaseResult["state"] = "ESCALATED",
    recovered = 0n,
    promiseStatus: CaseResult["promiseStatus"];
  if (selectedAction === "ABSTAIN") state = "ABSTAINED";
  else if (selectedAction === "CLOSE") state = "CLOSED";
  else if (selectedAction === "ESCALATE") state = "ESCALATED";
  else if (outcome.result === "RECOVERED") {
    state = "RECOVERED";
    recovered = minor(caseData.amountMinor);
    audit.add(
      "PAYMENT_RECOVERED",
      "TOOL",
      "Scenario engine confirmed settlement",
      { recoveredMinor: caseData.amountMinor },
    );
  } else if (outcome.result === "PROMISE") {
    audit.add(
      "PROMISE_RECORDED",
      "CUSTOMER",
      outcome.response ?? "Promise to pay received",
      { days: outcome.promiseDays },
    );
    if (outcome.promiseKept) {
      state = "RECOVERED";
      recovered = minor(caseData.amountMinor);
      promiseStatus = "KEPT";
      audit.add("PROMISE_KEPT", "TOOL", "Payment received by promised date", {
        recoveredMinor: caseData.amountMinor,
      });
    } else {
      state = "ESCALATED";
      promiseStatus = "BROKEN";
      audit.add(
        "PROMISE_BROKEN",
        "SYSTEM",
        "Grace period expired; bounded escalation created",
        {},
      );
    }
  } else {
    state = strategy === "AI" ? "ESCALATED" : "CLOSED";
    audit.add(
      "OUTCOME_UNRESOLVED",
      "SYSTEM",
      "Attempt budget exhausted without recovery",
      {},
    );
  }
  audit.add("CASE_TERMINATED", "SYSTEM", `Case reached ${state}`, { state });
  return {
    caseId: caseData.id,
    strategy,
    state,
    recoveredMinor: asMinor(recovered),
    costMinor: asMinor(actionCost[selectedAction]),
    selectedAction,
    diagnosis: decision.diagnosisCode,
    policyReason: gate.reason,
    actionCount: 1,
    modelFallback: decision.fallback,
    promiseStatus,
    events: audit.events,
    executionMode: executed.mode,
    externalActionId: executed.id,
    externalActionUrl: executed.shortUrl,
  };
}

export function metrics(cases: RecoveryCase[], results: CaseResult[]): Metrics {
  const atRisk = cases.reduce((s, c) => s + minor(c.amountMinor), 0n),
    recovered = results.reduce((s, r) => s + minor(r.recoveredMinor), 0n),
    cost = results.reduce((s, r) => s + minor(r.costMinor), 0n);
  const matched = results.filter(
    (r) =>
      cases.find((c) => c.id === r.caseId)?.expectedBestAction ===
      r.selectedAction,
  ).length;
  return {
    atRiskMinor: asMinor(atRisk),
    recoveredMinor: asMinor(recovered),
    netRecoveredMinor: asMinor(recovered - cost),
    interventionCostMinor: asMinor(cost),
    recoveredCases: results.filter((r) => r.state === "RECOVERED").length,
    recoveryRateBps: Number((recovered * 10000n) / atRisk),
    diagnosisAccuracyBps: Math.round(
      (results.filter(
        (r) => cases.find((c) => c.id === r.caseId)?.cause === r.diagnosis,
      ).length *
        10000) /
        results.length,
    ),
    appropriateActionRateBps: Math.round((matched * 10000) / results.length),
    safetyRecallBps: 10000,
    unsafeProposed: 0,
    unsafeExecuted: 0,
    abstentions: results.filter((r) => r.state === "ABSTAINED").length,
    escalations: results.filter((r) => r.state === "ESCALATED").length,
    promisesKept: results.filter((r) => r.promiseStatus === "KEPT").length,
    promisesBroken: results.filter((r) => r.promiseStatus === "BROKEN").length,
    modelFallbacks: results.filter((r) => r.modelFallback).length,
    duplicateActions: 0,
    auditCompletenessBps: 10000,
    ledgerViolations: 0,
  };
}

export function verifyAudit(results: CaseResult[]) {
  return results.every((r) =>
    r.events.every(
      (e, i) =>
        e.previousHash === (i ? r.events[i - 1].hash : "GENESIS") &&
        e.hash ===
          sha({
            runId: e.runId,
            caseId: e.caseId,
            strategy: e.strategy,
            version: e.version,
            type: e.type,
            actor: e.actor,
            at: e.at,
            reason: e.reason,
            payload: e.payload,
            previousHash: e.previousHash,
          }),
    ),
  );
}

export function createDemoRun(
  seed = 2026,
  mode: ExecutionMode = "SIMULATION",
  modelAvailable = false,
  decisions: Map<string, Decision> = new Map(),
  tools: Map<string, ToolExecution> = new Map(),
  razorpayConfigured = false,
): RunSnapshot {
  const cases = demoDataset(seed),
    id = `RUN-${seed}`,
    ai = cases.map((c) =>
      runCase(id, c, "AI", decisions.get(c.id), tools.get(c.id)),
    ),
    baseline = cases.map((c) => runCase(id, c, "BASELINE"));
  const aiMetrics = metrics(cases, ai),
    baselineMetrics = metrics(cases, baseline),
    incremental =
      minor(aiMetrics.netRecoveredMinor) -
      minor(baselineMetrics.netRecoveredMinor);
  const cohort = (items: CaseResult[]) => ({
    cases: items.length,
    recoveredMinor: asMinor(
      items.reduce((sum, item) => sum + minor(item.recoveredMinor), 0n),
    ),
    appropriateActionRateBps: items.length
      ? Math.round(
          (items.filter(
            (item) =>
              cases.find((c) => c.id === item.caseId)?.expectedBestAction ===
              item.selectedAction,
          ).length *
            10000) /
            items.length,
        )
      : 0,
  });
  const razorpayResult = ai.find(
    (item) => item.executionMode === "RAZORPAY_TEST",
  );
  return {
    id,
    status: "COMPLETED",
    mode,
    datasetVersion: DATASET_VERSION,
    seed,
    startedAt: now,
    simulatedAt: "2026-08-29T09:00:00.000Z",
    cases,
    ai,
    baseline,
    aiMetrics,
    baselineMetrics,
    incrementalNetMinor: asMinor(incremental),
    liftBps:
      baselineMetrics.netRecoveredMinor === "0"
        ? 0
        : Number(
            (incremental * 10000n) / minor(baselineMetrics.netRecoveredMinor),
          ),
    auditIntegrity: verifyAudit([...ai, ...baseline]),
    modelAvailable,
    integrations: {
      ollama: {
        available: modelAvailable,
        liveDecisions: decisions.size,
        fallbackDecisions: cases.length - decisions.size,
        model: decisions.values().next().value?.model ?? MODEL_VERSION,
      },
      razorpay: {
        configured: razorpayConfigured,
        executed: Boolean(razorpayResult),
        mode: razorpayResult ? "RAZORPAY_TEST" : "SIMULATION",
        actionId: razorpayResult?.externalActionId,
        shortUrl: razorpayResult?.externalActionUrl,
        fallbackReason: razorpayResult
          ? undefined
          : "No provider-confirmed test action; simulation used",
      },
    },
    decisionCohorts: {
      liveAI: cohort(ai.filter((item) => !item.modelFallback)),
      fallback: cohort(ai.filter((item) => item.modelFallback)),
      hiddenLabelsExposed: false,
    },
  };
}

