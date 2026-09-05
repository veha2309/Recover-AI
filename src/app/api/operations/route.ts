import {bootstrapOperations,operationsSnapshot} from "@/lib/operations";
export const runtime="nodejs";
export async function GET(){return Response.json(operationsSnapshot())}
export async function POST(){try{return Response.json(bootstrapOperations(),{status:201})}catch(error){return Response.json({error:error instanceof Error?error.message:"Bootstrap failed"},{status:409})}}

