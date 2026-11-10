import fs from "node:fs";
import path from "node:path";
import type { Decision, Goal, MethodId, Purchase } from "./types";
import { buildPersonas } from "./personas";

export interface GoalChange {
  at: string;
  action: "create" | "update" | "delete";
  goalId: string;
  name: string;
  summary: string;
}

export interface PersonaState {
  goals: Goal[];
  goalHistory: GoalChange[];
  purchases: Purchase[];
  prefs: { horizon: "short" | "medium" | "long"; risk: "conservative" | "balanced" | "growth"; custom?: { cash: number; bonds: number; index: number } };
}

export interface OrderRecord {
  orderId: string;
  personaId: string;
  decisionId: string;
  productId: string;
  productName: string;
  method: MethodId;
  amount: number;
  status: "CREATED" | "CAPTURED" | "FAILED" | "UNKNOWN";
  captureId?: string;
  createdAt: string;
  simulated?: boolean;
}

export interface StoreData {
  version: 1;
  personas: Record<string, PersonaState>;
  decisions: Record<string, Decision>;
  orders: Record<string, OrderRecord>;
  webhookEvents: Record<string, string>;
}

const STORE_PATH = process.env.STORE_PATH || path.join(process.cwd(), "data", "store.json");

function fresh(): StoreData {
  const personas: Record<string, PersonaState> = {};
  for (const p of buildPersonas()) {
    personas[p.id] = { goals: p.goals, goalHistory: [], purchases: [], prefs: { horizon: "medium", risk: "balanced" } };
  }
  return { version: 1, personas, decisions: {}, orders: {}, webhookEvents: {} };
}

let cache: StoreData | null = null;

export function load(): StoreData {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as StoreData;
  } catch {
    cache = fresh();
    save(cache);
  }
  return cache;
}

export function save(data: StoreData) {
  cache = data;
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, STORE_PATH); // atomic replace so a crash never leaves half a file
}

/** Apply a change and persist it. Everything runs in one Node process, so this is serialized. */
export function update<T>(fn: (d: StoreData) => T): T {
  const d = load();
  const out = fn(d);
  save(d);
  return out;
}

export function reset() {
  save(fresh());
}
