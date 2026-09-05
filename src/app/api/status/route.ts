import { aiStatus } from "@/lib/ai";
export async function GET() {
  return Response.json({
    ollama: await aiStatus(),
    razorpayTest: Boolean(
      process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") &&
      process.env.RAZORPAY_KEY_SECRET,
    ),
  });
}

