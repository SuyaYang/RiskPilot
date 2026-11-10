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

function decisionFacts(d: Decision, personaName: string, buffer: number) {
  const options = d.options
    .filter((o) => o.eligible)
    .map((o) => ({
      option: o.label,
      product: o.productName,
      price: o.price,
      risk: o.forecast.risk,
      lowestBalance: Math.round(o.forecast.minBalance),
      lowestBalanceDate: fmtDate(o.forecast.minBalanceDate),
      cushionAboveBuffer: Math.round(o.forecast.bufferGap),
      lowestBalanceIfPayLate: Math.round(o.forecast.stressMinBalance),
      interestEstimate: Math.round(o.extraCost),
      goalDelaysInDays: Object.fromEntries(o.goalImpact.map((g) => [g.name, g.delayDays])),
      recommended: o.recommended,
    }));
  return { person: personaName, cashBuffer: buffer, recommendedOption: d.options.find((o) => o.recommended)?.label, options };
}

function allowedNumbers(facts: ReturnType<typeof decisionFacts>): number[] {
  const out: number[] = [facts.cashBuffer];
  for (const o of facts.options) {
    out.push(o.price, o.lowestBalance, o.cushionAboveBuffer, Math.abs(o.cushionAboveBuffer), o.lowestBalanceIfPayLate, o.interestEstimate);
    out.push(...Object.values(o.goalDelaysInDays));
    out.push(...Object.values(o.goalDelaysInDays).map((d) => Math.round(d / 7)), ...Object.values(o.goalDelaysInDays).map((d) => Math.round(d / 30)));
    const day = Number(o.lowestBalanceDate.split(" ")[1]);
    if (day) out.push(day);
    out.push(o.price / 4);
  }
  return out;
}

export function templateExplanation(d: Decision, buffer: number): string {
  const rec = d.options.find((o) => o.recommended) as OptionResult;
  const full = d.options.find((o) => o.method === "full");
  if (rec.method === "wait") {
    return `Every way of paying would take your balance below your ${money(buffer)} cash buffer in the next 45 days, so the safest choice is to wait. Your lowest projected balance even without this purchase is ${money(rec.forecast.minBalance)} on ${fmtDate(rec.forecast.minBalanceDate)}.`;
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
  const facts = decisionFacts(d, personaName, buffer);
  const allowed = allowedNumbers(facts);
  const system =
    "You explain a purchase decision to the buyer in plain English, 3 to 4 short sentences, speaking to them as 'you'. " +
    "Use ONLY numbers that appear in FACTS, written as whole dollars or as given. Never invent numbers or dates. " +
    "Say which option is recommended and the main trade-off versus paying in full. Mention goal delays in days or weeks. " +
    "Do not give investment advice and do not mention specific stocks or funds. If the recommendation is to wait, say so plainly.";
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await gemini(`FACTS:\n${JSON.stringify(facts, null, 2)}`, system);
    if (!text) break;
    const check = numbersAreGrounded(text, allowed);
    if (check.ok) return { text: text.trim(), source: "ai" as const };
    console.warn("Explanation rejected, ungrounded numbers:", check.bad);
  }
  return { text: templateExplanation(d, buffer), source: "template" as const };
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
    return {
      name: String(j.name).slice(0, 60),
      type: j.type === "invest" ? "invest" : "spend",
      targetAmount: Math.round(amount),
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
