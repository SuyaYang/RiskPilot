import { currentDemoAccount } from "./demoAccounts";
import { cookies } from "next/headers";
import { buildPersonas } from "./personas";
import { load, ensurePersona, type StoreData } from "./store";
import crypto from "node:crypto";
import type { Payment, Persona } from "./types";
import { projectGoals } from "./engine/goals";
import { investableNow } from "./engine/investable";
import { compileSpending } from "./planning/spendingBaseline";
import { compilePlanning } from "./planning/integration";
import { iso, today } from "./dates";

export const PERSONA_COOKIE = "rp_persona";

/** Fictional workspace plus a fixed account profile; neither cookie is production authentication. */
export async function currentPersonaId(): Promise<string> {
  const jar = await cookies();
  const workspace = jar.get("rp_workspace")?.value;
  if (!workspace || !/^[a-f0-9-]{36}$/.test(workspace)) throw new Error("Demo workspace missing; reload the page");
  const persona = (await currentDemoAccount()).personaId;
  const id = `${workspace}:${persona}`;
  ensurePersona(id);
  return id;
}

export function personaWithState(id: string, data: StoreData = load()): { persona: Persona; payments: Payment[] } {
  const base = buildPersonas().find((p) => p.id === id.split(":").at(-1));
  if (!base) throw new Error("Unknown persona");
  const st = data.personas[id];
  const compiled = compilePlanning(base, st);
  const everydaySpending = compileSpending(base, st);
  const persona: Persona = { ...base, ...(everydaySpending ? { everydaySpending } : {}), goals: st?.goals ?? base.goals, ...(compiled.planning ? { planning: compiled.planning } : {}) };
  const payments = (st?.purchases ?? []).flatMap((x) => x.payments);
  return { persona, payments };
}

export function inputHash(id: string, data: StoreData = load()) {
  const { persona, payments } = personaWithState(id, data);
  // Declaring an identical baseline must not invalidate existing purchase assessments.
  const { everydaySpending, ...legacy } = persona;
  const financialPersona = everydaySpending?.categories.some(row => row.override) ? persona : legacy;
  return crypto.createHash("sha256").update(JSON.stringify({ persona: financialPersona, payments, asOf: iso(today()), policy: "rp-v1-step87" })).digest("hex");
}

export function snapshot(id: string, data: StoreData = load()) {
  const { persona, payments } = personaWithState(id, data);
  const { forecast: f, allocation: alloc } = projectGoals(persona, persona.goals, payments);
  const future = payments.filter((x) => x.date > iso(today()));
  const inv = investableNow(persona, f, alloc);
  if (persona.planning) {
    // A user-entered receipt (or reduced goal reserve after replacement) must not create capacity.
    const { planning: _planning, ...withoutPlanning } = persona;
    const { forecast: conservative, allocation: legacyAllocation } = projectGoals(withoutPlanning, persona.goals, payments);
    inv.investable = Math.min(inv.investable, investableNow(withoutPlanning, conservative, legacyAllocation).investable);
  }
  const st = data.personas[id];
  return {
    financialInputHash: inputHash(id, data),
    ...(persona.planning ? { planning: persona.planning } : {}),
    persona: {
      id: persona.id,
      name: persona.name,
      tagline: persona.tagline,
      buffer: persona.buffer,
      checkingBalance: persona.checkingBalance,
      savingsBalance: persona.savingsBalance,
      recurring: persona.recurring,
    },
    forecast: f,
    allocation: alloc,
    investable: inv,
    upcomingPayments: future,
    purchases: st?.purchases ?? [],
    goals: persona.goals,
    goalHistory: st?.goalHistory ?? [],
    prefs: st?.prefs,
    asOf: iso(today()),
    source: "fictional-manual-demo" as const,
    schemaVersion: "rp-v1" as const,
  };
}
