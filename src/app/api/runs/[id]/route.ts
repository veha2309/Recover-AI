import { repository } from "@/lib/store";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: RouteContext<"/api/runs/[id]">,
) {
  const { id } = await context.params;
  const run = repository.get(id);
  return run
    ? Response.json(run)
    : Response.json({ error: "Run not found" }, { status: 404 });
}
