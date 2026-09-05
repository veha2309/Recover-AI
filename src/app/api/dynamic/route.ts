import { dynamicSnapshot, generateDynamicCases } from "@/lib/dynamic";
import { z } from "zod";
export const runtime = "nodejs";
const schema = z
  .object({ count: z.number().int().min(1).max(10).default(5) })
  .strict();
export async function GET() {
  return Response.json(dynamicSnapshot());
}
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success)
    return Response.json(
      { error: "Invalid generation request" },
      { status: 400 },
    );
  return Response.json(generateDynamicCases(parsed.data.count), {
    status: 201,
  });
}
