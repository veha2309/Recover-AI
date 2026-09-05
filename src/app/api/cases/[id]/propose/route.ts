import { demoDataset } from "@/lib/dataset";
import { deterministicDecision, policy } from "@/lib/engine";
import { proposeWithAI } from "@/lib/ai";
export async function POST(
  _request: Request,
  context: RouteContext<"/api/cases/[id]/propose">,
) {
  const { id } = await context.params;
  const item = demoDataset().find((c) => c.id === id);
  if (!item) return Response.json({ error: "Case not found" }, { status: 404 });
  let decision;
  try {
    decision = await proposeWithAI(item);
  } catch {
    decision = deterministicDecision(item, "AI");
  }
  return Response.json({ decision, policy: policy(item, decision.action) });
}

