import { buildOptions } from "./engine/options";
import { forecast } from "./engine/forecast";
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
  return { decision, buffer: persona.buffer, inputChanged: data.decisions[order.decisionId]?.inputHash !== hash };
}
