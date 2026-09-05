import "server-only";
import Razorpay from "razorpay";

export interface TestPaymentLinkInput {referenceId:string;amountMinor:string;currency:"INR";customerName:string;customerEmail?:string}
export async function createRazorpayTestLink(input:TestPaymentLinkInput){
 const keyId=process.env.RAZORPAY_KEY_ID,keySecret=process.env.RAZORPAY_KEY_SECRET;
 if(!keyId||!keySecret||!keyId.startsWith("rzp_test_"))return {mode:"SIMULATION" as const,id:`sim_link_${input.referenceId}`,shortUrl:`https://example.test/pay/${input.referenceId}`,fallbackReason:"Razorpay test credentials unavailable"};
 const client=new Razorpay({key_id:keyId,key_secret:keySecret});
 const link=await client.paymentLink.create({amount:Number(input.amountMinor),currency:input.currency,accept_partial:false,reference_id:input.referenceId,description:"RecoverAI test-mode recovery",customer:{name:input.customerName,email:input.customerEmail??"demo@recoverai.test"},notify:{sms:false,email:false},reminder_enable:false,notes:{mode:"RAZORPAY_TEST",product:"RecoverAI"}});
 return {mode:"RAZORPAY_TEST" as const,id:link.id,shortUrl:link.short_url};
}

