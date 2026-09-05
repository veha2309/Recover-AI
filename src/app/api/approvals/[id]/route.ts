import {decideApproval} from "@/lib/operations";
export const runtime="nodejs";
export async function POST(request:Request,context:RouteContext<"/api/approvals/[id]">){const {id}=await context.params;try{return Response.json(decideApproval(id,await request.json()))}catch(error){return Response.json({error:error instanceof Error?error.message:"Decision failed"},{status:409})}}

