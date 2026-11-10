import { NextResponse } from "next/server";
import { demoEnabled } from "@/lib/checkout";
import { paypalConfigured } from "@/lib/paypal";

export async function GET() {
  return NextResponse.json({
    paypal: paypalConfigured(),
    paypalClientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || null,
    simulation: demoEnabled() && !paypalConfigured(),
    mode: "fictional-demo",
    ai: Boolean(process.env.GEMINI_API_KEY),
  });
}
