import {
  getDynamicCase,
  planDynamicCase,
  reserveInference,
} from "@/lib/dynamic";
import { deterministicDecision, policy } from "@/lib/engine";
import { proposeWithAI } from "@/lib/ai";
export const runtime = "nodejs";
export async function POST(
  _request: Request,
  context: RouteContext<"/api/dynamic/cases/[id]/plan">,
) {
  const { id } = await context.params,
    current = getDynamicCase(id);
  if (!current)
    return Response.json({ error: "Dynamic case not found" }, { status: 404 });
  let decision = deterministicDecision(current.source, "AI"),
    source: "OLLAMA" | "FALLBACK" = "FALLBACK";
  if (reserveInference()) {
    try {
      decision = await proposeWithAI(current.source);
      source = "OLLAMA";
    } catch {
      /* bounded fallback */
    }
  }
  const gate = policy(current.source, decision.action);
  try {
    return Response.json(
      planDynamicCase(id, {
        action: gate.action,
        diagnosis: decision.diagnosisCode,
        source,
      }),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Planning failed" },
      { status: 409 },
    );
  }
}

