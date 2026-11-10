import { NextRequest, NextResponse } from "next/server";

// An opaque workspace cookie isolates fictional demo data between browsers. This is not login.
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  const existing = req.cookies.get("rp_workspace")?.value;
  const workspace = existing && /^[a-f0-9-]{36}$/.test(existing) ? existing : crypto.randomUUID();
  if (workspace !== existing) {
    headers.set("cookie", `${headers.get("cookie") || ""}; rp_workspace=${workspace}`);
  }
  if (req.nextUrl.pathname.startsWith("/api/") && !req.nextUrl.pathname.startsWith("/api/webhooks/")) {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.get("origin");
      const expected = new URL(process.env.APP_ORIGIN || req.url).origin;
      if ((origin && origin !== expected) || req.headers.get("sec-fetch-site") === "cross-site") {
        return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
      }
    }
  }
  const res = NextResponse.next({ request: { headers } });
  if (workspace !== existing) res.cookies.set("rp_workspace", workspace, {
    httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/", maxAge: 604800,
  });
  if (req.nextUrl.pathname.startsWith("/api/")) res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
