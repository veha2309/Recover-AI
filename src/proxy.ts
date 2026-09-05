import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/api/health" || pathname === "/api/webhooks/razorpay") return NextResponse.next();
  const password = process.env.DEMO_PASSWORD;
  if (!password && process.env.NODE_ENV === "production") {
    return new NextResponse("Configure DEMO_PASSWORD before sharing this demo.", { status: 503 });
  }
  if (password) {
    const expected = Buffer.from(`Basic ${Buffer.from(`demo:${password}`).toString("base64")}`);
    const actual = Buffer.from(request.headers.get("authorization") || "");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return new NextResponse("Demo sign-in required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="RecoverAI demo", charset="UTF-8"', "Cache-Control": "no-store" } });
    }
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    // TLS terminates at Render's proxy, so nextUrl may be an internal HTTP URL.
    // Trust a configured public URL, never client-supplied forwarded headers.
    const publicUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
    let expectedOrigin = request.nextUrl.origin;
    if (publicUrl) {
      try { expectedOrigin = new URL(publicUrl).origin; }
      catch { return NextResponse.json({ error: "Invalid public URL configuration" }, { status: 503 }); }
    }
    if (origin && origin !== expectedOrigin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
