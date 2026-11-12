import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { currentPersonaId, personaWithState, inputHash } from "@/lib/state";
import { getProduct } from "@/lib/catalog";
import { buildOptions } from "@/lib/engine/options";
import { forecast } from "@/lib/engine/forecast";
import { explainDecision } from "@/lib/ai";
import { CheckoutError } from "@/lib/checkout";
import { apiError } from "@/lib/http";
import { load, update } from "@/lib/store";
import type { Decision } from "@/lib/types";

export async function POST(req: Request) {
  try {
  const { productId } = await req.json().catch(() => ({}));
  const product = getProduct(productId);
  if (!product) return NextResponse.json({ error: "Unknown product" }, { status: 400 });
  const alternative = product.alternativeId ? getProduct(product.alternativeId) : undefined;
  const personaId = await currentPersonaId();
  const store=load();
  const { persona, payments } = personaWithState(personaId,store);
  const { options, recommended, afterIncome } = buildOptions(persona, persona.goals, payments, product, alternative);
  const decision: Decision = {
    id: crypto.randomUUID(),
    personaId,
    productId,
    createdAt: new Date().toISOString(),
    inputHash: inputHash(personaId,store),
    schemaVersion: "rp-v1", origin:"shop", currency:"USD",
    baseline: forecast(persona, payments),
    options, afterIncome,
    recommendedMethod: recommended,
  };
  decision.explanation = await explainDecision(decision, persona.name, persona.buffer);
  update((d) => {
    if(inputHash(personaId,d)!==decision.inputHash)throw new CheckoutError("STALE_DECISION","Your financial inputs changed while the assessment was prepared. Please assess again.",409);
    d.decisions[decision.id] = decision;
  });
  return NextResponse.json({ decision, buffer: persona.buffer });
  } catch(error){return apiError(error);}
}
