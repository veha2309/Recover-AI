import { afterEach, describe, expect, it, vi } from "vitest";
import { proposeWithAI, aiStatus } from "../src/lib/ai";
import { demoDataset } from "../src/lib/dataset";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Gemini planner", () => {
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
