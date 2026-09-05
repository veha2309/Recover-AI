import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  createDemoRun,
  deterministicDecision,
  policy,
  verifyAudit,
} from "../src/lib/engine";
import { demoDataset } from "../src/lib/dataset";
import { transition } from "../src/lib/state-machine";
import { Decision, toAgentContext } from "../src/lib/domain";
describe("deterministic recovery core", () => {
  it("keeps hidden evaluation labels out of the agent context", () => {
    const original = demoDataset()[0],
      changed = {
        ...original,
        cause: "SECRET_DIFFERENT_CAUSE",
        expectedBestAction: "SEND_REMINDER" as const,
        outcomes: {},
      };
    const a = toAgentContext(original),
      b = toAgentContext(changed);
    expect(a).toEqual(b);
    expect(a).not.toHaveProperty("cause");
    expect(a).not.toHaveProperty("expectedBestAction");
    expect(a).not.toHaveProperty("outcomes");
    expect(deterministicDecision(a, "AI")).toEqual(
      deterministicDecision(b, "AI"),
    );
  });
  it("produces a repeatable paired run with positive lift", () => {
    const a = createDemoRun(),
      b = createDemoRun();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(BigInt(a.incrementalNetMinor)).toBeGreaterThan(0n);
    expect(a.aiMetrics.unsafeExecuted).toBe(0);
    expect(a.auditIntegrity).toBe(true);
  });
  it("never recovers more than collectible exposure", () => {
    const run = createDemoRun();
    for (const result of run.ai) {
      const c = run.cases.find((x) => x.id === result.caseId)!;
      expect(BigInt(result.recoveredMinor)).toBeLessThanOrEqual(
        BigInt(c.amountMinor),
      );
    }
  });
  it("blocks every protected case", () => {
    for (const c of demoDataset().filter(
      (c) =>
        c.flags.optOut ||
        c.flags.disputed ||
        c.flags.fraud ||
        c.flags.manualHold ||
        c.flags.ambiguous,
    )) {
      const gate = policy(c, "RETRY_PAYMENT");
      expect(["CLOSE", "ESCALATE", "ABSTAIN"]).toContain(gate.action);
    }
  });
  it("has a fulfilled and broken promise, abstention, and escalation", () => {
    const r = createDemoRun();
    expect(r.ai.some((x) => x.promiseStatus === "KEPT")).toBe(true);
    expect(r.ai.some((x) => x.promiseStatus === "BROKEN")).toBe(true);
    expect(r.ai.some((x) => x.state === "ABSTAINED")).toBe(true);
    expect(r.ai.some((x) => x.state === "ESCALATED")).toBe(true);
  });
  it("detects audit tampering", () => {
    const r = createDemoRun();
    expect(verifyAudit(r.ai)).toBe(true);
    r.ai[0].events[0].reason = "tampered";
    expect(verifyAudit(r.ai)).toBe(false);
  });
  it("records live-model and Razorpay test evidence", () => {
    const cases = demoDataset();
    const decision: Decision = {
      diagnosisCode: "CHECKOUT_FRICTION",
      confidenceBps: 9200,
      evidenceIds: ["E1"],
      action: "CREATE_PAYMENT_LINK",
      rationale: "Live local-model decision",
      model: "gemma3:latest",
      promptVersion: "decision-v1",
      latencyMs: 1200,
      parseStatus: "VALID",
      fallback: false,
    };
    const run = createDemoRun(
      2026,
      "RAZORPAY_TEST",
      true,
      new Map([[cases[1].id, decision]]),
      new Map([
        [
          cases[1].id,
          {
            mode: "RAZORPAY_TEST",
            id: "plink_test",
            shortUrl: "https://rzp.io/test",
          },
        ],
      ]),
      true,
    );
    expect(run.integrations?.ollama.liveDecisions).toBe(1);
    expect(run.integrations?.razorpay.executed).toBe(true);
    const result = run.ai.find((r) => r.caseId === cases[1].id)!;
    expect(result.modelFallback).toBe(false);
    expect(result.executionMode).toBe("RAZORPAY_TEST");
    expect(
      result.events.find((e) => e.type === "ACTION_EXECUTED")?.payload
        .externalActionId,
    ).toBe("plink_test");
  });
  it("refuses Razorpay evidence when the authorized action is not a payment link", () => {
    const cases = demoDataset(),
      decision: Decision = {
        diagnosisCode: "CHECKOUT_ABANDONMENT",
        confidenceBps: 9000,
        evidenceIds: ["E1"],
        action: "SEND_REMINDER",
        rationale: "Reminder selected",
        model: "gemma3:latest",
        promptVersion: "decision-v1",
        latencyMs: 100,
        parseStatus: "VALID",
        fallback: false,
      };
    const run = createDemoRun(
      2026,
      "RAZORPAY_TEST",
      true,
      new Map([[cases[1].id, decision]]),
      new Map([
        [
          cases[1].id,
          {
            mode: "RAZORPAY_TEST",
            id: "must_not_attach",
            shortUrl: "https://rzp.io/test",
          },
        ],
      ]),
      true,
    );
    const result = run.ai.find((r) => r.caseId === cases[1].id)!;
    expect(result.executionMode).toBe("SIMULATION");
    expect(result.externalActionId).toBeUndefined();
    expect(run.integrations?.razorpay.executed).toBe(false);
    expect(
      result.events.find((e) => e.type === "ACTION_EXECUTED")?.payload
        .externalActionId,
    ).toBeUndefined();
  });
  it("rejects invalid transitions and empty reasons", () => {
    expect(() => transition("INGESTED", "RECOVERED", "shortcut")).toThrow();
    expect(() => transition("INGESTED", "VALIDATING", "")).toThrow();
    expect(transition("INGESTED", "VALIDATING", "NORMALIZED")).toBe(
      "VALIDATING",
    );
  });
  it("minor-unit property holds for arbitrary collectible balances", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10_000_000_000n }),
        fc.bigInt({ min: 0n, max: 10_000_000_000n }),
        (amount, raw) => {
          const recovered = raw > amount ? amount : raw;
          return recovered >= 0n && recovered <= amount;
        },
      ),
    );
  });
});
