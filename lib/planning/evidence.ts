import crypto from "node:crypto";
/** UI explanation freshness only; never a checkout financial-input version. */
export function planningEvidenceHash(financialInputHash: string, income: { version: number; epoch: string }, budget: { version: number; epoch: string; basisHash: string }) {
  return crypto.createHash("sha256").update(JSON.stringify({ financialInputHash, income, budget })).digest("hex");
}
