import { load, update, type StoreData } from "../store";
import { CheckoutError } from "../checkout";
import { explainFinancialProfile } from "../ai";
import { profileBasis } from "./features";
import type { FinancialProfileState, ProfileFocus } from "./types";

export function financialProfileView(owner: string, data: StoreData = load()) {
  const basis = profileBasis(owner, data), generated = basis.state.generated;
  const fresh = generated?.basisHash === basis.basisHash;
  const plan = generated && fresh ? {
    summary: basis.features.summaries[generated.summaryId],
    insights: generated.insightIds.filter(id => basis.features.allowedInsights.includes(id)).map(id => ({ id, ...basis.features.facts[id] })),
    action: basis.features.actions[generated.actionId as keyof typeof basis.features.actions],
    source: generated.source, generatedAt: generated.generatedAt,
  } : null;
  return {
    version: basis.state.version, basisHash: basis.basisHash, financialInputHash: basis.financialHash,
    status: basis.state.dismissed ? "dismissed" as const : generated ? fresh ? "ready" as const : "stale" as const : "not_generated" as const,
    profile: plan, preferences: basis.state.preferences || null, dismissedInsightIds: basis.state.dismissedInsightIds,
    evidence: basis.features.facts, coverage: basis.features.coverage, asOf: basis.features.asOf,
    activeGoals: basis.features.activeGoals, engineBufferCents: basis.features.engineBufferCents,
    privacy: "Only aggregated fictional facts are sent to Gemini when you generate. Raw transactions, account IDs and payment identifiers are not sent.",
    preferencePolicy: "Planning preferences personalize explanations only. Existing forecast buffers, bill commitments and goal priorities require their existing explicit controls.",
  };
}
export type FinancialProfileView = ReturnType<typeof financialProfileView>;
function checkVersion(body: Record<string,unknown>, basis: ReturnType<typeof profileBasis>) {
  if (!Number.isSafeInteger(body.version) || body.version !== basis.state.version || body.basisHash !== basis.basisHash) throw new CheckoutError("STALE_PROFILE", "Financial or profile inputs changed. Refresh your profile before saving.");
}
export async function generateFinancialProfile(owner: string, body: Record<string,unknown>) {
  const before = profileBasis(owner);
  checkVersion(body,before);
  const result = await explainFinancialProfile(before.features);
  return update(data => {
    const current = profileBasis(owner,data); checkVersion(body,current);
    const state: FinancialProfileState = data.personas[owner].financialProfile ??= { version:0, dismissedInsightIds:[] };
    state.generated = { ...result, basisHash: current.basisHash, generatedAt: new Date().toISOString() };
    state.dismissed = false; state.version++;
    return financialProfileView(owner,data);
  });
}
export function editFinancialProfile(owner: string, body: Record<string,unknown>) {
  return update(data => {
    const before = profileBasis(owner,data); checkVersion(body,before);
    const state = data.personas[owner].financialProfile ??= { version:0, dismissedInsightIds:[] };
    if (body.action === "confirm_preferences") {
      const allowed = ["action","version","basisHash","planningBufferCents","priorityGoalId","focus"];
      if (Object.keys(body).some(key => !allowed.includes(key)) || !Number.isSafeInteger(body.planningBufferCents) || Number(body.planningBufferCents) < 0 || Number(body.planningBufferCents) > 100_000_000 ||
        !["cash_buffer","goals","commitments"].includes(String(body.focus)) ||
        (body.priorityGoalId !== null && (typeof body.priorityGoalId !== "string" || !before.features.activeGoals.some(goal => goal.id === body.priorityGoalId)))) throw new CheckoutError("INVALID_PROFILE", "Choose a valid planning buffer, focus and active savings goal.",400);
      state.preferences = { planningBufferCents: Number(body.planningBufferCents), priorityGoalId: body.priorityGoalId as string | null, focus: body.focus as ProfileFocus, confirmedAt: new Date().toISOString() };
      delete state.generated; state.dismissed = false;
    } else if (body.action === "dismiss_insight") {
      if (Object.keys(body).some(key => !["action","version","basisHash","insightId"].includes(key)) || typeof body.insightId !== "string" || !before.features.allowedInsights.includes(body.insightId)) throw new CheckoutError("INVALID_PROFILE", "Choose an available optional observation.",400);
      state.dismissedInsightIds = [...new Set([...state.dismissedInsightIds, body.insightId])];
      if (state.generated && state.generated.basisHash === before.basisHash) {
        state.generated.insightIds = state.generated.insightIds.filter(id => id !== body.insightId);
        const revised = profileBasis(owner,data);
        if(!Object.hasOwn(revised.features.summaries,state.generated.summaryId)) delete state.generated;
        else state.generated.basisHash = revised.basisHash;
      }
    } else if (body.action === "dismiss_profile" || body.action === "restore_insights" || body.action === "clear_preferences") {
      if (Object.keys(body).some(key => !["action","version","basisHash"].includes(key))) throw new CheckoutError("INVALID_PROFILE", "Unsupported profile fields.",400);
      delete state.generated;
      if (body.action === "clear_preferences") { delete state.preferences; state.dismissed = false; }
      else if (body.action === "dismiss_profile") state.dismissed = true;
      else { state.dismissedInsightIds = []; state.dismissed = false; }
    } else throw new CheckoutError("INVALID_PROFILE", "Choose a supported profile action.",400);
    state.version++;
    return financialProfileView(owner,data);
  });
}
