import { NextResponse } from "next/server";
import { inputHash as currentInputHash, currentPersonaId } from "@/lib/state";
import { ownedOrder, CheckoutError } from "@/lib/checkout";
import { orderReview } from "@/lib/orderReview";
import { REVIEW_QUESTIONS, reviewFacts, type ReviewQuestion } from "@/lib/reviewInsights";
import { answerCopilot, explainReviewFacts } from "@/lib/ai";
import { apiError } from "@/lib/http";
import type { MethodId } from "@/lib/types";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const order = ownedOrder((await ctx.params).id, await currentPersonaId());
    if (order.status === "CAPTURED") throw new CheckoutError("ALREADY_PAID", "View the saved forecast for this completed purchase.", 409);
    const body = await req.json().catch(() => ({}));
    if (typeof body.question !== "string" || !Object.hasOwn(REVIEW_QUESTIONS, body.question)) throw new CheckoutError("INVALID_QUESTION", "Choose a supported review question.", 400);
    if (body.prompt !== undefined && (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 800)) throw new CheckoutError("INVALID_QUESTION", "Enter a question of up to 800 characters.", 400);
    const review = orderReview(order);
    if (body.inputHash !== review.decision.inputHash) throw new CheckoutError("STALE_REVIEW", "Refresh the impact to use your latest financial inputs.", 409);
    if (!review.decision.options.some(item => item.method === body.method && item.eligible)) throw new CheckoutError("INVALID_SCENARIO", "Choose an available forecast scenario.", 400);
    if(body.timing!==undefined && !["now","after_income"].includes(body.timing))throw new CheckoutError("INVALID_SCENARIO", "Choose a supported purchase timing.", 400);
    if(body.timing==="after_income" && (body.method!=="full" || !review.decision.afterIncome?.available))throw new CheckoutError("INVALID_SCENARIO", "After-income preview is unavailable for this scenario.", 400);
    if (body.compact !== undefined && typeof body.compact !== "boolean") throw new CheckoutError("INVALID_QUESTION", "Choose a supported explanation format.", 400);
    const question = body.question as ReviewQuestion;
    const { facts, required, inputHash } = reviewFacts(review, body.method as MethodId, question, body.timing || "now");
    if (body.prompt && !process.env.GEMINI_API_KEY) throw new CheckoutError("AI_UNAVAILABLE", "Gemini is not configured. Use the suggested questions or configure the server key.", 503);
    const explanation = body.prompt ? await answerCopilot(body.prompt.trim(), "Checkout review", facts) : await explainReviewFacts(facts, body.compact ? ["checkout_summary"] : required, REVIEW_QUESTIONS[question]);
    if (currentInputHash(order.personaId) !== inputHash) throw new CheckoutError("STALE_REVIEW", "Your finances changed. Refresh this review before asking again.", 409);
    return NextResponse.json({ ...explanation, inputHash, uncertainty: facts.uncertainty, readOnly: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
