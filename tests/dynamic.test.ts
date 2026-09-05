import { beforeAll, describe, expect, it, vi } from "vitest";
import path from "node:path";
vi.mock("server-only", () => ({}));
let dynamic: typeof import("../src/lib/dynamic");
beforeAll(async () => {
  process.env.RECOVERAI_DB = path.join(
    process.cwd(),
    "data",
    `dynamic-test-${process.pid}-${Date.now()}.sqlite`,
  );
  dynamic = await import("../src/lib/dynamic");
});
describe("dynamic recovery lab", () => {
  it("adds and prioritizes cases without restart", () => {
    const snapshot = dynamic.generateDynamicCases(3);
    expect(snapshot.cases).toHaveLength(3);
    expect(snapshot.cases[0].priorityScore).toBeGreaterThanOrEqual(
      snapshot.cases[1].priorityScore,
    );
    expect(snapshot.counts.NEW).toBe(3);
  });
  it("progresses one event at a time with the simulated clock", () => {
    const item = dynamic
      .dynamicSnapshot()
      .cases.find((c) => c.sourceCaseId.endsWith("001"))!;
    let snapshot = dynamic.planDynamicCase(item.id, {
      action: "RETRY_PAYMENT",
      diagnosis: "INSUFFICIENT_FUNDS",
      source: "FALLBACK",
    });
    expect(snapshot.cases.find((c) => c.id === item.id)?.state).toBe(
      "ACTION_SCHEDULED",
    );
    snapshot = dynamic.advanceDynamicClock(2).snapshot;
    expect(snapshot.cases.find((c) => c.id === item.id)?.state).toBe(
      "WAITING_FOR_OUTCOME",
    );
    snapshot = dynamic.advanceDynamicClock(2).snapshot;
    expect(snapshot.cases.find((c) => c.id === item.id)?.state).toBe(
      "RECOVERED",
    );
  });
  it("classifies promise, dispute, and opt-out replies safely", () => {
    let snapshot = dynamic.dynamicSnapshot();
    const promise = snapshot.cases.find((c) => c.sourceCaseId.endsWith("002"))!,
      closed = snapshot.cases.find((c) => c.sourceCaseId.endsWith("003"))!;
    snapshot = dynamic.recordDynamicReply(promise.id, {
      message: "I promise I will pay by Friday",
      expectedVersion: promise.version,
    });
    expect(snapshot.cases.find((c) => c.id === promise.id)?.state).toBe(
      "PROMISE_PENDING",
    );
    snapshot = dynamic.recordDynamicReply(closed.id, {
      message: "Stop contacting me",
      expectedVersion: closed.version,
    });
    expect(snapshot.cases.find((c) => c.id === closed.id)?.state).toBe(
      "CLOSED",
    );
    snapshot = dynamic.advanceDynamicClock(72).snapshot;
    expect(snapshot.cases.find((c) => c.id === promise.id)?.state).toBe(
      "ESCALATED",
    );
  });
  it("maintains a linked event sequence", () => {
    const events = dynamic.dynamicSnapshot().events;
    for (const caseId of new Set(events.map((e) => e.caseId))) {
      const chain = events
        .filter((e) => e.caseId === caseId)
        .sort((a, b) => a.sequence - b.sequence);
      expect(chain[0].previousHash).toBe("GENESIS");
      for (let i = 1; i < chain.length; i++)
        expect(chain[i].previousHash).toBe(chain[i - 1].hash);
    }
  });
});
