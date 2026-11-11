import { NextResponse } from "next/server";
import { currentPersonaId } from "@/lib/state";
import { CheckoutError } from "@/lib/checkout";
import { apiError } from "@/lib/http";
import { explainProfilePurchase } from "@/lib/financialProfile/purchase";
export async function POST(req: Request) {
  try {
    const value = await req.json().catch(() => null);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new CheckoutError("INVALID_PROFILE","Choose an existing purchase assessment.",400);
    return NextResponse.json(await explainProfilePurchase(await currentPersonaId(),value));
  } catch(error) { return apiError(error); }
}
