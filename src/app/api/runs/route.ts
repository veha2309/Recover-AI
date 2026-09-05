import { createRunSchema, Decision, toAgentContext } from "@/lib/domain";
import { demoDataset } from "@/lib/dataset";
import {
  createDemoRun,
  deterministicDecision,
  policy,
  ToolExecution,
} from "@/lib/engine";
import { aiStatus, proposeWithAI, aiFailureReason } from "@/lib/ai";
import { createRazorpayTestLink } from "@/lib/razorpay";
import { repository } from "@/lib/store";
export const runtime = "nodejs";
export async function GET() {
  const run = repository.latest();
  return Response.json(run);
}
export async function POST(request: Request) {
  const parsed = createRunSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success)
    return Response.json(
      { error: "Invalid run request", details: parsed.error.flatten() },
      { status: 400 },
    );
  const status = await aiStatus();
  const cases = demoDataset(parsed.data.seed);
  const decisions = new Map<string, Decision>();
  const failures = new Set<string>();
  if (!status.available || !status.model) failures.add("AI provider is not configured or available.");
  if (status.available && status.model) {
    const liveCases = cases.slice(0, 4);
    let cursor = 0;
    const workers = Array.from({ length: 2 }, async () => {
      while (cursor < liveCases.length) {
        const item = liveCases[cursor++];
        try {
          decisions.set(item.id, await proposeWithAI(item));
        } catch (error) {
          failures.add(aiFailureReason(error));
        }
      }
    });
    await Promise.all(workers);
  }
  const razorpayConfigured = Boolean(
    process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") &&
    process.env.RAZORPAY_KEY_SECRET,
  );
  const tools = new Map<string, ToolExecution>();
  if (parsed.data.mode === "RAZORPAY_TEST" && razorpayConfigured) {
    const checkout = cases.find((item) => item.id.endsWith("002"))!;
    const context = toAgentContext(checkout),
      decision =
        decisions.get(checkout.id) ?? deterministicDecision(context, "AI"),
      gate = policy(context, decision.action);
    if (gate.action === "CREATE_PAYMENT_LINK")
      try {
        const action = await createRazorpayTestLink({
          referenceId: `recoverai-${checkout.id}-${Date.now()}`,
          amountMinor: checkout.amountMinor,
          currency: checkout.currency,
          customerName: checkout.customer,
        });
        tools.set(checkout.id, {
          mode: action.mode,
          id: action.id,
          shortUrl: action.shortUrl,
        });
      } catch {
        /* run remains safe and simulated */
      }
  }
  const run = createDemoRun(
    parsed.data.seed,
    parsed.data.mode,
    status.available && status.model,
    decisions,
    tools,
    razorpayConfigured,
  );
  if (run.integrations) {
    run.integrations.ollama.model = status.modelName;
    run.integrations.ollama.fallbackReasons = [...failures];
  }
  repository.save(run);
  return Response.json(run, { status: 201 });
}

