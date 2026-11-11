import { cookies } from "next/headers";

export const ACCOUNT_COOKIE = "rp_account";
/** Fixed fictional demo identities and entitlements. This is not authentication or billing. */
export const DEMO_ACCOUNTS = [
  { id: "alex", email: "alex@riskpilot.demo", name: "Alex", personaId: "alex", tier: "premium" },
  { id: "sam", email: "sam@riskpilot.demo", name: "Sam", personaId: "sam", tier: "premium" },
  { id: "jordan", email: "jordan@riskpilot.demo", name: "Jordan", personaId: "jordan", tier: "basic" },
] as const;
export type DemoAccount = typeof DEMO_ACCOUNTS[number];
export async function currentDemoAccount(): Promise<DemoAccount> {
  const jar = await cookies();
  const account = jar.get(ACCOUNT_COOKIE)?.value;
  // Keep existing fictional workspaces/payment ownership readable during migration.
  // An explicit account cookie wins over the retired persona cookie.
  const id = account || jar.get("rp_persona")?.value;
  return DEMO_ACCOUNTS.find(item => item.id === id) || DEMO_ACCOUNTS[0];
}
export function accountAccess(account: DemoAccount) {
  return { tier: account.tier, detailedAnalysis: account.tier === "premium", demo: true as const };
}
