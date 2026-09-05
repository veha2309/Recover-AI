import { demoDataset } from "@/lib/dataset";
import { policy } from "@/lib/engine";
import { createRazorpayTestLink } from "@/lib/razorpay";
import { z } from "zod";
const bodySchema=z.object({expectedVersion:z.number().int().positive(),idempotencyKey:z.string().min(8),reason:z.string().min(3)}).strict();
export async function POST(request:Request,context:RouteContext<"/api/cases/[id]/payment-link">){const {id}=await context.params;const item=demoDataset().find(c=>c.id===id);if(!item)return Response.json({error:"Case not found"},{status:404});const body=bodySchema.safeParse(await request.json().catch(()=>null));if(!body.success)return Response.json({error:"Invalid mutation envelope"},{status:400});const gate=policy(item,"CREATE_PAYMENT_LINK");if(!gate.allowed)return Response.json({error:"Policy blocked action",policy:gate},{status:403});try{return Response.json({policy:gate,tool:await createRazorpayTestLink({referenceId:`${id}-${body.data.idempotencyKey}`,amountMinor:item.amountMinor,currency:item.currency,customerName:item.customer})})}catch{return Response.json({error:"Razorpay test action failed safely",fallback:"Use deterministic simulation"},{status:502})}}

