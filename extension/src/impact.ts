import { buildPersonas } from "../../lib/personas";
import { buildOptions } from "../../lib/engine/options";

/** Same deterministic kernel as RiskPilot; fixtures only, independent of the merchant's catalog. */
export function assessExternalPurchase(amount: number, personaId: string) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) throw new Error("Invalid USD order total");
  const persona = buildPersonas().find(p => p.id === personaId);
  if (!persona) throw new Error("Unknown fictional profile");
  const result = buildOptions(persona, persona.goals, [], {
    id: "external-checkout", name: "This checkout", price: amount, description: "Visible PayPal Sandbox order total",
  });
  return { persona, options: result.options.filter(o => o.method !== "cheaper" && o.method !== "wait") };
}
