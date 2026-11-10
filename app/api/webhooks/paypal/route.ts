import { NextResponse } from "next/server";
import { load, update } from "@/lib/store";
import { verifyWebhook } from "@/lib/paypal";
import { recordCapture } from "@/lib/purchases";

/** PayPal webhook: verified, de-duplicated by event id, and idempotent by capture id. */
export async function POST(req: Request) {
  const raw = await req.text();
  let ok = false;
  try {
    ok = await verifyWebhook(req.headers, raw);
  } catch (e) {
    console.warn("Webhook verification error", (e as Error).message);
  }
  if (!ok) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  const event = JSON.parse(raw);
  if (load().webhookEvents[event.id]) return NextResponse.json({ ok: true, duplicate: true });
  update((d) => {
    d.webhookEvents[event.id] = event.event_type;
  });

  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
    const order = orderId ? load().orders[orderId] : undefined;
    if (order && order.status !== "CAPTURED") {
      try {
        recordCapture(orderId, event.resource.id, Number(event.resource.amount?.value));
      } catch (e) {
        console.warn("Webhook capture not recorded", (e as Error).message);
      }
    }
  }
  return NextResponse.json({ ok: true });
}
