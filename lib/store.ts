import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Decision, Goal, MethodId, Purchase } from "./types";
import type { snapshot } from "./state";
import { buildPersonas } from "./personas";

export interface GoalChange { at: string; action: "create" | "update" | "delete"; goalId: string; name: string; summary: string }
export interface PersonaState {
  goals: Goal[]; goalHistory: GoalChange[]; purchases: Purchase[];
  prefs: { horizon: "short" | "medium" | "long"; risk: "conservative" | "balanced" | "growth"; custom?: { cash: number; bonds: number; index: number } };
}
export interface OrderRecord {
  orderId: string; personaId: string; decisionId: string; productId: string; productName: string;
  method: MethodId; amount: number; currency: "USD"; status: "CREATED" | "CAPTURED" | "FAILED" | "UNKNOWN";
  captureId?: string; createdAt: string; simulated?: boolean;
  captureRequestId: string; captureCommand?: "STARTED" | "UNKNOWN" | "COMPLETED"; captureStartedAt?: number;
  approvalUrl?: string; projectionStatus?: "PENDING" | "UPDATED"; snapshotId?: string;
  settlementReview?: string;
}
export interface CreateCommand {
  requestId: string; personaId: string; decisionId: string; method: MethodId;
  state: "STARTED" | "UNKNOWN" | "COMPLETED"; orderId?: string; startedAt: number; firstAttemptAt: number;
}
export interface WebhookRecord { type: string; state: "RECEIVED" | "PROCESSED" | "IGNORED"; raw: string }
export interface StoreData {
  version: 2;
  personas: Record<string, PersonaState>;
  decisions: Record<string, Decision>;
  orders: Record<string, OrderRecord>;
  commands: Record<string, CreateCommand>;
  webhookEvents: Record<string, WebhookRecord>;
  snapshots: Record<string, { id: string; personaId: string; orderId: string; inputHash: string; schemaVersion: "rp-v1"; createdAt: string; data: ReturnType<typeof snapshot> }>;
}
const STORE_PATH = process.env.STORE_PATH || path.join(process.cwd(), "data", "store.json");
const fresh = (): StoreData => ({ version: 2, personas: {}, decisions: {}, orders: {}, commands: {}, webhookEvents: {}, snapshots: {} });

export function newPersona(id: string): PersonaState {
  const base = buildPersonas().find(p => p.id === id.split(":").at(-1));
  if (!base) throw new Error("Unknown demo persona");
  return { goals: base.goals.map(g => ({ ...g, version: 1 })), goalHistory: [], purchases: [], prefs: { horizon: "medium", risk: "balanced" } };
}
export function ensurePersona(id: string) {
  if (!load().personas[id]) update(d => { d.personas[id] ??= newPersona(id); });
}
export function load(): StoreData {
  try {
    const data = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
    // Never silently erase captures from an old or corrupt store.
    if (data.version !== 2) throw new Error("Legacy store: keep a backup and use a new STORE_PATH. Never reset verified payment records.");
    return data as StoreData;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fresh();
    throw e;
  }
}
function save(data: StoreData) {
  const tmp = `${STORE_PATH}.${crypto.randomUUID()}.tmp`;
  const fd = fs.openSync(tmp, "wx", 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(data)); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(tmp, STORE_PATH);
}
/** Local demo transaction: reread under an exclusive process lock; publish only after success. */
export function update<T>(fn: (d: StoreData) => T): T {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const lock = `${STORE_PATH}.lock`;
  // Fail closed rather than break a potentially active writer's lock.
  const fd = fs.openSync(lock, "wx", 0o600);
  try {
    fs.writeFileSync(fd, `${process.pid}`);
    const d = load();
    const out = fn(d);
    save(d);
    return out;
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
export function reset(personaId: string) {
  update(d => {
    if (Object.values(d.orders).some(o => o.personaId === personaId && !o.simulated)) {
      throw new Error("This workspace has Sandbox orders. Use a new browser workspace to preserve payment records.");
    }
    d.personas[personaId] = newPersona(personaId);
    for (const [id, x] of Object.entries(d.decisions)) if (x.personaId === personaId) delete d.decisions[id];
    for (const [id, x] of Object.entries(d.orders)) if (x.personaId === personaId) delete d.orders[id];
    for (const [id, x] of Object.entries(d.commands)) if (x.personaId === personaId) delete d.commands[id];
    for (const [id, x] of Object.entries(d.snapshots)) if (x.personaId === personaId) delete d.snapshots[id];
  });
}
