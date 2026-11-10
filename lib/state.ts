import { cookies } from "next/headers";
import { buildPersonas } from "./personas";
import { load } from "./store";
import type { Payment, Persona } from "./types";
import { forecast } from "./engine/forecast";
import { allocateGoals } from "./engine/goals";
import { investableNow } from "./engine/investable";
import { iso, today } from "./dates";

export const PERSONA_COOKIE = "rp_persona";

/** The demo has no login: the active persona lives in a cookie and every server route checks it. */
export async function currentPersonaId(): Promise<string> {
  const c = (await cookies()).get(PERSONA_COOKIE)?.value;
  return buildPersonas().some((p) => p.id === c) ? (c as string) : "alex";
}

export function personaWithState(id: string): { persona: Persona; payments: Payment[] } {
  const base = buildPersonas().find((p) => p.id === id);
  if (!base) throw new Error("Unknown persona");
  const st = load().personas[id];
  const persona: Persona = { ...base, goals: st?.goals ?? base.goals };
  const payments = (st?.purchases ?? []).flatMap((x) => x.payments);
  return { persona, payments };
}

export function snapshot(id: string) {
  const { persona, payments } = personaWithState(id);
  const f = forecast(persona, payments);
  const future = payments.filter((x) => x.date > iso(today()));
  const alloc = allocateGoals(persona, persona.goals, future, Math.max(0, -f.bufferGap));
  const inv = investableNow(persona, f, alloc);
  const st = load().personas[id];
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
  };
}
