import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/paypal";
import { processVerifiedWebhook } from "@/lib/webhooks";
export async function POST(req: Request) {
  const raw = await req.text();
  try {
    if (!await verifyWebhook(req.headers, raw)) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  } catch { return NextResponse.json({ error: "Signature verification unavailable; retry" }, { status: 503 }); }
  try { return NextResponse.json({ ok: true, ...processVerifiedWebhook(raw) }); }
  catch { return NextResponse.json({ error: "Event not processed; retry delivery" }, { status: 503 }); }
}
