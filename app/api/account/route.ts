import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE, DEMO_ACCOUNTS, currentDemoAccount, accountAccess } from "@/lib/demoAccounts";
import { demoEnabled } from "@/lib/checkout";
export async function GET() {
  const account = await currentDemoAccount();
  return NextResponse.json({ account, access: accountAccess(account), demo: true });
}
export async function POST(req: Request) {
  if (!demoEnabled()) return NextResponse.json({ error: "Demo account sign-in is disabled." }, { status: 404 });
  const value = await req.json().catch(() => null);
  const account = value && typeof value.email === "string" && Object.keys(value).every(key => key === "email")
    ? DEMO_ACCOUNTS.find(item => item.email === value.email.trim().toLowerCase()) : null;
  if (!account) return NextResponse.json({ error: "Use a listed fictional demo email. No real account is created." }, { status: 400 });
  const res = NextResponse.json({ account, access: accountAccess(account), demo: true });
  res.cookies.set(ACCOUNT_COOKIE, account.id, { httpOnly: true, sameSite: "lax", secure: new URL(req.url).protocol === "https:", path: "/", maxAge: 604800 });
  return res;
}
