export function GET() {
  return Response.json({ status: "ok", paymentMode: "test-only" });
}
