import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPersonas } from "../lib/personas";
import { buildOptions } from "../lib/engine/options";
import { getProduct } from "../lib/catalog";
import { explainDecision, explainReviewFacts, parseGoal } from "../lib/ai";
import type { Decision } from "../lib/types";

test("AI cannot introduce unsupported financial sentences; outage uses template", async t => {
  process.env.DEMO_TODAY = "2026-11-10";
  const p = buildPersonas()[0], result = buildOptions(p, p.goals, [], getProduct("aero-14")!, getProduct("aero-13"));
  const d: Decision = { id: "test", personaId: p.id, productId: "aero-14", inputHash: "test", schemaVersion: "rp-v1", createdAt: "2026-11-10", baseline: result.options.at(-1)!.forecast, options: result.options, recommendedMethod: result.recommended };
  const originalFetch = globalThis.fetch;
  const key = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "fixture-not-a-real-key";
  const respond = (value: unknown) => { globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }); };
  try {
    await t.test("valid fact IDs select only server-owned text", async () => {
      respond({ factIds: ["recommendation", "buffer", "stress"] });
      const out = await explainDecision(d, p.name, p.buffer);
      assert.equal(out.source, "ai"); assert.match(out.text, /hypothetical/); assert.match(out.text, /cash buffer/);
    });
    await t.test("invented facts and extra free text cannot enter the explanation", async () => {
      respond({ factIds: ["recommendation", "buffer", "I guarantee approval at 0%"] });
      assert.equal((await explainDecision(d, p.name, p.buffer)).source, "template");
      respond({ factIds: ["recommendation", "buffer"], text: "Guaranteed free loan for everyone" });
      assert.doesNotMatch((await explainDecision(d, p.name, p.buffer)).text, /Guaranteed/);
    });
    await t.test("provider outage falls back without changing numbers", async () => {
      globalThis.fetch = async () => new Response("unavailable", { status: 503 });
      const out = await explainDecision(d, p.name, p.buffer); assert.equal(out.source, "template");
    });
    await t.test("invalid calendar date in an AI goal draft is rejected", async () => {
      respond({ name: "Trip", type: "spend", targetAmount: 1000, targetDate: "2027-02-30", priority: 2 });
      assert.equal(await parseGoal("Trip next February", "2026-11-10"), null);
    });
    await t.test("review copilot preserves required facts and discards model-authored payment claims", async () => {
      const facts = { outlook: "Projected cash is $820.", uncertainty: "Funding is unconfirmed." };
      respond({ factIds: ["uncertainty", "outlook"], text: "Your payment is completed." });
      const ordered = await explainReviewFacts(facts, ["outlook", "uncertainty"], "Can I afford this?");
      assert.equal(ordered.source, "ai"); assert.equal(ordered.text, "Funding is unconfirmed. Projected cash is $820.");
      respond({ factIds: ["outlook", "capture_payment"] });
      const fallback = await explainReviewFacts(facts, ["outlook", "uncertainty"], "Can I afford this?");
      assert.equal(fallback.source, "template"); assert.match(fallback.text, /Funding is unconfirmed/);
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key;
  }
});
