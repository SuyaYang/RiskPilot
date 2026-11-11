import type { PurchaseReview } from "./orderReview";
import type { accountAccess } from "./demoAccounts";
/** A Basic checkout retains critical risk facts, without scenario/timeline payloads. */
export function reviewForAccess(review: PurchaseReview, access: ReturnType<typeof accountAccess>): PurchaseReview {
  if (access.detailedAnalysis) return review;
  return { ...review, decision: { ...review.decision,
    baseline: { ...review.decision.baseline, dailyBalances: [] },
    options: review.decision.options.filter(option => option.method === "full").map(option => ({ ...option, payments: [], goalPlan: undefined, forecast: { ...option.forecast, dailyBalances: [] } })),
    afterIncome: { available: false, reason: "Detailed timing comparisons are a Premium demo feature." },
  } };
}
