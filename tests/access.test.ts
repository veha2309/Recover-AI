import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
afterEach(() => vi.unstubAllEnvs());
it("fails closed in production without a demo password but permits health checks", () => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("DEMO_PASSWORD", "");
  expect(proxy(new NextRequest("https://demo.example/api/runs")).status).toBe(503);
  expect(proxy(new NextRequest("https://demo.example/api/health")).status).toBe(200);
});
it("requires credentials for API reads and rejects cross-origin writes", () => {
  vi.stubEnv("DEMO_PASSWORD", "test-password");
  expect(proxy(new NextRequest("https://demo.example/api/runs")).status).toBe(401);
  const authorization = `Basic ${Buffer.from("demo:test-password").toString("base64")}`;
  expect(proxy(new NextRequest("https://demo.example/api/runs", { headers: { authorization } })).status).toBe(200);
  expect(proxy(new NextRequest("https://demo.example/api/runs", { method: "POST", headers: { authorization, origin: "https://elsewhere.example" } })).status).toBe(403);
});
