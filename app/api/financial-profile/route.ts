import { NextResponse } from "next/server";
import { currentPersonaId } from "@/lib/state";
import { CheckoutError } from "@/lib/checkout";
import { apiError } from "@/lib/http";
import { financialProfileView, generateFinancialProfile, editFinancialProfile } from "@/lib/financialProfile/service";
export const dynamic = "force-dynamic";
async function body(req: Request) {
  const value = await req.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CheckoutError("INVALID_PROFILE","Invalid profile request.",400);
  return value as Record<string,unknown>;
}
export async function GET() { try { return NextResponse.json(financialProfileView(await currentPersonaId())); } catch(error) { return apiError(error); } }
export async function POST(req: Request) {
  try { const value = await body(req); if (Object.keys(value).some(key => !["version","basisHash"].includes(key))) throw new CheckoutError("INVALID_PROFILE","Only current profile inputs may be generated.",400); return NextResponse.json(await generateFinancialProfile(await currentPersonaId(),value)); } catch(error) { return apiError(error); }
}
export async function PATCH(req: Request) { try { return NextResponse.json(editFinancialProfile(await currentPersonaId(),await body(req))); } catch(error) { return apiError(error); } }
