import { advanceDynamicClock } from "@/lib/dynamic";
import { z } from "zod";
export const runtime = "nodejs";
const schema = z.object({ hours: z.number().int().min(1).max(720) }).strict();
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Hours must be between 1 and 720" },
      { status: 400 },
    );
  try {
    return Response.json(advanceDynamicClock(parsed.data.hours));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Clock failed" },
      { status: 409 },
    );
  }
}
