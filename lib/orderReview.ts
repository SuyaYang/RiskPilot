import { buildOptions } from "./engine/options";
import { forecast, occurrences, HORIZON_DAYS } from "./engine/forecast";
import { addDays, iso, today } from "./dates";
import { inputHash, personaWithState } from "./state";
import { load, type OrderRecord } from "./store";
import type { Decision } from "./types";

/** Reassess current finances for the frozen merchant amount, without calling capture or writing. */
export function orderReview(order: OrderRecord) {
  const data = load();
  const { persona, payments } = personaWithState(order.personaId, data);
  const result = buildOptions(persona, persona.goals, payments, {
    id: order.productId, name: order.productName, price: order.amount, description: "Frozen checkout product",
  });
  const hash = inputHash(order.personaId, data);
  const decision: Decision = {
    id: order.decisionId, personaId: order.personaId, productId: order.productId,
    createdAt: new Date().toISOString(), inputHash: hash, schemaVersion: "rp-v1",
    baseline: forecast(persona, payments), options: result.options, recommendedMethod: result.recommended,
  };
  const asOf = iso(today());
  const upcoming = [
    ...persona.recurring.filter(item => item.direction === "out").flatMap(item =>
      occurrences(item, HORIZON_DAYS).map(day => ({ date: iso(addDays(today(), day)), amount: item.amount, label: item.name, source: "fixture" as const }))),
    ...payments.filter(item => item.date > asOf && item.date < iso(addDays(today(), HORIZON_DAYS)))
      .map(item => ({ ...item, source: "purchase-reserve" as const })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return { decision, buffer: persona.buffer, inputChanged: data.decisions[order.decisionId]?.inputHash !== hash,
    context: { asOf, personaName: persona.name, source: "fictional-manual-demo" as const, upcoming } };
}

export type PurchaseReview = ReturnType<typeof orderReview>;
