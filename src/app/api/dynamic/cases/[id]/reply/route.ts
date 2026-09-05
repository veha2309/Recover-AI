import { recordDynamicReply } from "@/lib/dynamic";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: RouteContext<"/api/dynamic/cases/[id]/reply">,
) {
  const { id } = await context.params;
  try {
    return Response.json(recordDynamicReply(id, await request.json()));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Reply rejected" },
      { status: 409 },
    );
  }
}
