import { repository } from "@/lib/store";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: RouteContext<"/api/runs/[id]/export">,
) {
  const { id } = await context.params;
  const run = repository.get(id);
  if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
  return new Response(
    JSON.stringify(
      {
        manifest: {
          runId: run.id,
          datasetVersion: run.datasetVersion,
          seed: run.seed,
          mode: run.mode,
          auditIntegrity: run.auditIntegrity,
          exportedAt: new Date().toISOString(),
        },
        run,
      },
      null,
      2,
    ),
    {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="${id}-audit.json"`,
      },
    },
  );
}
