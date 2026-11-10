import type { Decision, OptionResult } from "./types";
import { fmtDate } from "./dates";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

async function gemini(prompt: string, system: string, json = false): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, ...(json ? { responseMimeType: "application/json" } : {}) },
        }),
        signal: ctrl.signal,
      },
    );
    if (!res.ok) {
      console.warn("Gemini error", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const body = await res.json();
    return body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? null;
  } catch (e) {
    console.warn("Gemini request failed", (e as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Every number in the text must match a number the engine produced (or a small known constant). */
export function numbersAreGrounded(text: string, allowed: number[]): { ok: boolean; bad: string[] } {
  const constants = [1, 2, 3, 4, 6, 7, 12, 14, 20, 30, 45, 2026, 2027];
  const pool = [...allowed, ...constants];
  const bad: string[] = [];
  for (const m of text.matchAll(/\$?\d[\d,]*(?:\.\d+)?%?/g)) {
    const raw = m[0];
    const n = Number(raw.replace(/[$,%]/g, ""));
    if (!Number.isFinite(n)) continue;
    const ok = pool.some((a) => Math.abs(a - n) <= 0.51 || (raw.includes("%") && Math.abs(a * 100 - n) <= 0.51));
    if (!ok) bad.push(raw);
  }
  return { ok: bad.length === 0, bad };
}

export function templateExplanation(d: Decision, buffer: number): string {
  const rec = d.options.find((o) => o.recommended) as OptionResult;
  const full = d.options.find((o) => o.method === "full");
  if (rec.method === "wait") {
    return `No purchase scenario keeps your ${money(buffer)} buffer intact under both the baseline and late-income checks, so waiting is the suggested scenario. Your lowest projected balance even without this purchase is ${money(rec.forecast.minBalance)} on ${fmtDate(rec.forecast.minBalanceDate)}.`;
  }
  const delays = rec.goalImpact.filter((g) => g.delayDays > 0).map((g) => `${g.name} by about ${g.delayDays} days`);
  const parts = [
    `${rec.label} keeps your lowest balance at ${money(rec.forecast.minBalance)} on ${fmtDate(rec.forecast.minBalanceDate)}, ${money(rec.forecast.bufferGap)} above your buffer.`,
  ];
  if (full && full.method !== rec.method) {
    parts.push(`Paying in full would bring it to ${money(full.forecast.minBalance)}${full.forecast.bufferGap < 0 ? ", below your buffer" : ""}.`);
  }
  parts.push(delays.length ? `It would push back ${delays.join(" and ")}.` : "It does not delay any of your goals.");
  if (rec.extraCost > 0) parts.push(`It adds an estimated ${money(rec.extraCost)} in interest.`);
  return parts.join(" ");
}

export async function explainDecision(d: Decision, personaName: string, buffer: number) {
  const rec = d.options.find(o => o.recommended)!;
  const full = d.options.find(o => o.method === "full");
  const facts: Record<string, string> = {
    recommendation: rec.method === "wait"
      ? `Waiting is the suggested scenario. Your lowest baseline projection is ${money(rec.forecast.minBalance)}.`
      : `${rec.hypothetical ? "In this hypothetical scenario, " : ""}${rec.label} gives a lowest projected balance of ${money(rec.forecast.minBalance)} on ${fmtDate(rec.forecast.minBalanceDate)}.`,
    buffer: `Your cash buffer is ${money(buffer)}; the scenario's minimum is ${money(Math.abs(rec.forecast.bufferGap))} ${rec.forecast.bufferGap < 0 ? "below" : "above"} it.`,
    stress: `If income arrives a week late, the lowest projection is ${money(rec.forecast.stressMinBalance)}.`,
  };
  if (full && rec.method !== "full") facts.comparison = `Paying in full gives a lowest projection of ${money(full.forecast.minBalance)}.`;
  const delays = rec.goalImpact.filter(g => g.delayDays > 0);
  facts.goals = delays.length ? delays.map(g => `${g.name} is delayed by ${g.delayDays} days.`).join(" ") : "This scenario adds no projected goal delay.";
  if (rec.extraCost > 0) facts.cost = `Estimated additional cost is ${money(rec.extraCost)}; actual terms are unconfirmed.`;
  const fallback = { text: templateExplanation(d, buffer), source: "template" as const };
  // Gemini chooses useful facts; only server-owned sentences enter the explanation. Numeric matching
  // alone cannot catch an AI assigning the right dollar amount to the wrong payment method.
  const raw = await gemini(JSON.stringify({ person: personaName, facts }),
    'Select 2 to 4 useful fact IDs for a short buyer explanation. Start with recommendation, include buffer. Return only JSON {"factIds":[...]}. Do not calculate or write new claims.', true);
  if (!raw) return fallback;
  try {
    const ids: unknown = JSON.parse(raw).factIds;
    if (!Array.isArray(ids) || ids.length < 2 || ids.length > 4 || ids[0] !== "recommendation" || !ids.includes("buffer") ||
        new Set(ids).size !== ids.length || ids.some(id => typeof id !== "string" || !Object.hasOwn(facts, id))) return fallback;
    return { text: ids.map(id => facts[id]).join(" "), source: "ai" as const };
  } catch { return fallback; }
}

export interface GoalDraft {
  name: string;
  type: "spend" | "invest";
  targetAmount: number;
  targetDate: string;
  priority: 1 | 2 | 3;
}

/** Turn "Japan trip next March, about $3,000" into a goal draft. The user confirms before saving. */
export async function parseGoal(text: string, todayIso: string): Promise<GoalDraft | null> {
  const system =
    "Extract one savings goal from the user's sentence. Return JSON with keys: name (short), type ('spend' or 'invest'), " +
    "targetAmount (number, USD), targetDate (YYYY-MM-DD; if only a month is given use the 15th; if no date, 12 months from today), " +
    "priority (1 high, 2 medium, 3 low; default 2). Use 'invest' only when the goal is to invest. Today is " + todayIso + ".";
  const out = await gemini(text, system, true);
  if (!out) return null;
  try {
    const j = JSON.parse(out);
    const amount = Number(j.targetAmount);
    if (!j.name || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(j.targetDate)) return null;
    const date = new Date(`${j.targetDate}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== j.targetDate) return null;
    return {
      name: String(j.name).slice(0, 60),
      type: j.type === "invest" ? "invest" : "spend",
      targetAmount: Math.round(amount * 100) / 100,
      targetDate: j.targetDate,
      priority: [1, 2, 3].includes(Number(j.priority)) ? (Number(j.priority) as 1 | 2 | 3) : 2,
    };
  } catch {
    return null;
  }
}

const CONCEPTS: Record<string, string> = {
  "index-fund":
    "A broad index fund holds small pieces of many companies at once, so its value follows a whole market rather than one company. That spreads risk, but the value still rises and falls with the market.",
  "bond-fund":
    "A bond fund holds loans to governments or companies that pay interest. It usually moves less than stock funds, but it can still lose value, especially when interest rates rise.",
  "short-horizon":
    "Money you need within a few years has little time to recover from a market drop, which is why short-term goals are usually kept in cash or savings rather than in stock funds.",
  "emergency-first":
    "A cash buffer covers surprises like a late paycheck or a repair, so you are not forced to sell investments at a bad time. That is why the investing checks look at your buffer first.",
};

export function conceptAnswer(id: string): string | null {
  return CONCEPTS[id] ?? null;
}
export const CONCEPT_LIST = [
  { id: "index-fund", q: "What is a broad index fund?" },
  { id: "bond-fund", q: "What is a bond fund?" },
  { id: "short-horizon", q: "Why not put short-term money in stocks?" },
  { id: "emergency-first", q: "Why build a buffer before investing?" },
];
