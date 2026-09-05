import {runDueJobs} from "@/lib/operations";
export const runtime="nodejs";
export async function POST(request:Request){const body=await request.json().catch(()=>({}));return Response.json(runDueJobs(typeof body.at==="string"?body.at:undefined))}

