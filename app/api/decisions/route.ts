import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { currentPersonaId, personaWithState } from "@/lib/state";
import { getProduct } from "@/lib/catalog";
import { buildOptions } from "@/lib/engine/options";
import { forecast } from "@/lib/engine/forecast";
import { explainDecision } from "@/lib/ai";
import { update } from "@/lib/store";
import type { Decision } from "@/lib/types";

export async function POST(req: Request) {
  const { productId } = await req.json().catch(() => ({}));
  const product = getProduct(productId);
  if (!product) return NextResponse.json({ error: "Unknown product" }, { status: 400 });
  const alternative = product.alternativeId ? getProduct(product.alternativeId) : undefined;
  const personaId = await currentPersonaId();
  const { persona, payments } = personaWithState(personaId);
  const { options, recommended } = buildOptions(persona, persona.goals, payments, product, alternative);
  const decision: Decision = {
    id: crypto.randomUUID(),
    personaId,
    productId,
    createdAt: new Date().toISOString(),
    baseline: forecast(persona, payments),
    options,
    recommendedMethod: recommended,
  };
  decision.explanation = await explainDecision(decision, persona.name, persona.buffer);
  update((d) => {
    d.decisions[decision.id] = decision;
  });
  return NextResponse.json({ decision, buffer: persona.buffer });
}
