import { afterEach, describe, expect, it, vi } from "vitest";
import { proposeWithAI, proposeBatchWithAI, aiStatus, aiFailureReason } from "../src/lib/ai";
import { demoDataset } from "../src/lib/dataset";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Gemini planner", () => {
  it("uses one request for four cases and rejects cross-case evidence", async () => {
    vi.stubEnv("AI_PROVIDER", "gemini"); vi.stubEnv("GOOGLE_API_KEY", "test-secret");
    const cases = demoDataset(42).slice(0, 4);
    const decisions = cases.map(c => ({ caseId: c.id, diagnosisCode: "RECOVERY", confidenceBps: 9000, evidenceIds: [`${c.id}-E1`], action: c.eligibleActions[0], rationale: "An eligible intervention." }));
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ decisions }) }] } }] })));
    vi.stubGlobal("fetch", fetchMock);
    expect((await proposeBatchWithAI(cases)).size).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text);
    expect(payload[0]).not.toHaveProperty("outcomes");
    decisions[1].evidenceIds = decisions[0].evidenceIds;
    await expect(proposeBatchWithAI(cases)).rejects.toThrow("per-case validation");
  });
  it("reports quota failures without exposing the provider body or secret", async () => {
    vi.stubEnv("AI_PROVIDER", "gemini"); vi.stubEnv("GOOGLE_API_KEY", "test-secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { message: "test-secret" } }, { status: 429 })));
    const error = await proposeWithAI(demoDataset(42)[0]).catch(error => error);
    expect(aiFailureReason(error)).toContain("quota");
    expect(aiFailureReason(error)).not.toContain("test-secret");
    expect(aiFailureReason(new Error("test-secret"))).not.toContain("test-secret");
  });
  it("reports missing credentials without a network request", async () => {
    vi.stubEnv("AI_PROVIDER", "gemini"); vi.stubEnv("GOOGLE_API_KEY", ""); vi.stubEnv("GEMINI_API_KEY", "");
    expect((await aiStatus()).available).toBe(false);
  });
  it("projects case evidence, keeps the key in the header, and validates output", async () => {
    vi.stubEnv("AI_PROVIDER", "gemini"); vi.stubEnv("GOOGLE_API_KEY", "test-secret");
    const item = demoDataset(42)[0];
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ diagnosisCode: "PAYMENT_FAILED", confidenceBps: 9000, evidenceIds: [`${item.id}-E1`], action: item.eligibleActions[0], rationale: "Evidence supports this eligible action." }) }] } }] }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await proposeWithAI(item)).fallback).toBe(false);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain("test-secret");
    expect(init.headers["x-goog-api-key"]).toBe("test-secret");
    const payload = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
    expect(payload).not.toHaveProperty("outcomes"); expect(payload).not.toHaveProperty("cause"); expect(payload).not.toHaveProperty("customer");
  });
  it("rejects blocked output after a bounded retry", async () => {
    vi.stubEnv("AI_PROVIDER", "gemini"); vi.stubEnv("GOOGLE_API_KEY", "test-secret");
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ candidates: [{ finishReason: "SAFETY" }] })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(proposeWithAI(demoDataset(42)[0])).rejects.toThrow("invalid decision");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
