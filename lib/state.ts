import { cookies } from "next/headers";
import { buildPersonas } from "./personas";
import { load, ensurePersona, type StoreData } from "./store";
import crypto from "node:crypto";
import type { Payment, Persona } from "./types";
import { forecast } from "./engine/forecast";
import { allocateGoals } from "./engine/goals";
import { investableNow } from "./engine/investable";
import { iso, today } from "./dates";

export const PERSONA_COOKIE = "rp_persona";

/** Fictional demo workspace only; persona selection is never an authentication credential. */
export async function currentPersonaId(): Promise<string> {
  const jar = await cookies();
  const workspace = jar.get("rp_workspace")?.value;
  if (!workspace || !/^[a-f0-9-]{36}$/.test(workspace)) throw new Error("Demo workspace missing; reload the page");
  const c = jar.get(PERSONA_COOKIE)?.value;
  const persona = buildPersonas().some((p) => p.id === c) ? c : "alex";
  const id = `${workspace}:${persona}`;
  ensurePersona(id);
  return id;
}

export function personaWithState(id: string, data: StoreData = load()): { persona: Persona; payments: Payment[] } {
  const base = buildPersonas().find((p) => p.id === id.split(":").at(-1));
  if (!base) throw new Error("Unknown persona");
  const st = data.personas[id];
  const persona: Persona = { ...base, goals: st?.goals ?? base.goals };
  const payments = (st?.purchases ?? []).flatMap((x) => x.payments);
  return { persona, payments };
}

export function inputHash(id: string, data: StoreData = load()) {
  const { persona, payments } = personaWithState(id, data);
  return crypto.createHash("sha256").update(JSON.stringify({ persona, payments, asOf: iso(today()), policy: "rp-v1" })).digest("hex");
}

export function snapshot(id: string, data: StoreData = load()) {
  const { persona, payments } = personaWithState(id, data);
  const f = forecast(persona, payments);
  const future = payments.filter((x) => x.date > iso(today()));
  const alloc = allocateGoals(persona, persona.goals, future, Math.max(0, -f.bufferGap));
  const inv = investableNow(persona, f, alloc);
  const st = data.personas[id];
  return {
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
