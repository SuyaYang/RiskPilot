import { NextResponse } from "next/server";
import { currentDemoAccount } from "@/lib/demoAccounts";
/** Compatibility read: one account has one fixed financial profile, never a selectable list. */
export async function GET() {
  const account = await currentDemoAccount();
  return NextResponse.json({ active: account.personaId, personas: [{ id: account.personaId, name: account.name, tagline: "Fictional account profile" }] });
}
export async function POST() {
  return NextResponse.json({ error: "An account has one fixed financial profile. Use demo account sign-in to change accounts." }, { status: 409 });
}
