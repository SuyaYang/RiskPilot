import crypto from "node:crypto";
import { snapshot, inputHash } from "../state";
import { load, type StoreData } from "../store";
import { demoEnabled, CheckoutError } from "../checkout";
import { spendingView, type SpendingView } from "../spending/service";
import { formatCents } from "../spending/money";
import { scheduledItems } from "../presentation";
import type { FinancialProfileState, ProfileFact, ProfileSelection } from "./types";
const cents = (amount: number) => Math.round(amount * 100);
const emptyState = (): FinancialProfileState => ({ version: 0, dismissedInsightIds: [] });

/** Aggregates only: no transaction records, account IDs, payment IDs or workspace IDs go to Gemini. */
export function extractProfileFeatures(financial: ReturnType<typeof snapshot>, spending: SpendingView | null, state: FinancialProfileState = emptyState()) {
  const full = spending?.analysis.months.filter(month => month.complete) || [];
  const coverage = spending ? `${spending.analysis.coverage.start} through ${spending.analysis.coverage.end}` : "No transaction coverage available";
  const preference = state.preferences;
  const confirmedPeriod = preference ? `${new Date(preference.confirmedAt).toLocaleString("en-US",{timeZone:"America/New_York",dateStyle:"medium",timeStyle:"short"})} ET` : financial.asOf;
  const activeGoals = financial.goals.filter(goal => !goal.paused && goal.savedSoFar < goal.targetAmount).sort((a,b) => a.priority - b.priority || a.targetDate.localeCompare(b.targetDate));
  const preferredGoal = preference?.priorityGoalId ? activeGoals.find(goal => goal.id === preference.priorityGoalId) : undefined;
  const commitments = scheduledItems(financial.persona.recurring, financial.upcomingPayments, financial.asOf);
  const facts: Record<string, ProfileFact> = {};
  const add = (id: string, text: string, kind: ProfileFact["kind"], source: string, period: string) => { facts[id] = { text, kind, source, period }; };
  add("data_scope", "All financial inputs and spending history are fictional demo data; no bank is connected.", "limitation", "Demo configuration", financial.asOf);
  add("capacity", `The engine reports ${formatCents(cents(financial.investable.investable))} available to allocate after buffer, delayed-income and goal checks.`, "predicted", "Existing financial engine", financial.forecast.evaluatedThrough);
  add("buffer", `The forecast protects a ${formatCents(cents(financial.persona.buffer))} buffer; lowest projected cash is ${formatCents(cents(financial.forecast.minBalance))}, or ${formatCents(cents(financial.forecast.stressMinBalance))} if income arrives a week late.`, "predicted", "Existing financial engine", `${financial.asOf} through ${financial.forecast.evaluatedThrough}`);
  add("commitments", `There are ${commitments.length} scheduled bill/reserve occurrences in the next 45 days, totaling ${formatCents(commitments.reduce((sum, event) => sum + cents(event.amount), 0))}; income and everyday spending are separate forecast inputs.`, "predicted", "Existing manual schedules and purchase reserves", `${financial.asOf} · next 45 days`);
  add("goals", activeGoals.length ? `There are ${activeGoals.length} active savings goals; ${activeGoals[0].name} is first by the existing goal priority and deadline.` : "No active savings goal is available; paused or completed goals are not treated as current priorities.", "observed", "User-maintained fictional goals", financial.asOf);
  if (full.length && spending?.analysis.averageMonthlyCents !== null) {
    add("spending", `${full.length} fully covered months of simulated history average ${formatCents(spending!.analysis.averageMonthlyCents!)} in net spending; partial months are excluded.`, "observed", "Phase 3 simulated spending aggregates", coverage);
    const top = spending!.analysis.categories.filter(row => row.averageMonthlyCents !== null && row.averageMonthlyCents > 0).sort((a,b) => b.averageMonthlyCents! - a.averageMonthlyCents!).slice(0,3);
    if (top.length) add("categories", `Complete-month category averages: ${top.map(row => `${row.category} ${formatCents(row.averageMonthlyCents!)}`).join("; ")}.`, "observed", "Phase 3 category aggregates", coverage);
    if (full.length >= 2) add("variability", `Across ${full.length} fully covered months, net spending ranged from ${formatCents(Math.min(...full.map(month => month.netCents)))} to ${formatCents(Math.max(...full.map(month => month.netCents)))}; this does not predict future spending.`, "observed", "Phase 3 monthly aggregates", coverage);
  }
  if (full.length < 2) add("history_limit", "There is insufficient complete-month history to describe a spending pattern; no behavioral trend is inferred.", "limitation", "History coverage check", coverage);
  const confirmed = spending?.candidates.filter(candidate => candidate.status === "confirmed") || [];
  add("recurring", `${confirmed.length} recurring patterns have been user-confirmed for review; they remain informational and are not added to forecast commitments.`, "user_confirmed", "Phase 3 recurring review", financial.asOf);
  if (preference) {
    add("preference", `Your confirmed planning buffer preference is ${formatCents(preference.planningBufferCents)}; the engine still uses its existing ${formatCents(cents(financial.persona.buffer))} buffer. Saving a preference does not change cash capacity.`, "user_confirmed", "Explicit profile confirmation", confirmedPeriod);
    add("focus", `Your confirmed explanation focus is ${preference.focus.replaceAll("_", " ")}${preferredGoal ? `, with ${preferredGoal.name} as your preferred active goal` : ""}. This does not change goal priorities or move money.`, "user_confirmed", "Explicit profile confirmation", confirmedPeriod);
    if (preference.priorityGoalId && !preferredGoal) add("goal_preference_limit", "The previously preferred goal is no longer active. Review your preference; no goal-specific assumption is used.", "limitation", "Current goal validation", financial.asOf);
  }
  facts.buffer.shortText = `Projected minimum ${formatCents(cents(financial.forecast.minBalance))}; late-income minimum ${formatCents(cents(financial.forecast.stressMinBalance))} versus a ${formatCents(cents(financial.persona.buffer))} buffer.`;
  facts.commitments.shortText = `${commitments.length} bill/reserve occurrences · ${formatCents(commitments.reduce((sum,event)=>sum+cents(event.amount),0))} over 45 days.`;
  facts.goals.shortText = activeGoals.length ? `First existing priority: ${activeGoals[0].name} (${activeGoals.length} active goals).` : "No active savings goal is available.";
  facts.recurring.shortText = `${confirmed.length} confirmed recurring patterns · informational, not new bills.`;
  if(facts.spending)facts.spending.shortText = `Full-month spending: ${formatCents(spending!.analysis.averageMonthlyCents!)} average from ${full.length} months.`;
  if(facts.variability)facts.variability.shortText = `Full-month spending range: ${formatCents(Math.min(...full.map(m=>m.netCents)))}–${formatCents(Math.max(...full.map(m=>m.netCents)))}.`;
  if(facts.categories)facts.categories.shortText = facts.categories.text;
  if(facts.preference)facts.preference.shortText = `Planning preference ${formatCents(preference!.planningBufferCents)}; engine buffer remains ${formatCents(cents(financial.persona.buffer))}.`;
  if(facts.focus)facts.focus.shortText = `Confirmed focus: ${preference!.focus.replaceAll("_"," ")}${preferredGoal ? ` · ${preferredGoal.name}` : ""}.`;
  const summaries: Record<string,string> = {
    summary_plan: `Your current plan protects a ${formatCents(cents(financial.persona.buffer))} cash buffer alongside ${activeGoals.length} active savings goals.`,
    summary_capacity: financial.investable.investable <= 0 ? "Your current forecast leaves no cash available to allocate after its financial safety checks." : `Your current forecast leaves ${formatCents(cents(financial.investable.investable))} available to allocate after its financial safety checks.`,
  };
  if (full.length >= 2) summaries.summary_spending = `Simulated full-month spending averages ${formatCents(spending!.analysis.averageMonthlyCents!)}; bills and reserves still drive forecasts.`;
  else summaries.summary_history = "Spending history is insufficient for a behavior pattern; this profile uses current bills, goals and engine constraints.";
  if(state.dismissedInsightIds.includes("spending")) delete summaries.summary_spending;
  const actions = {
    review_cash: { label: "Review cash flow", href: "/#overview-chart-title" },
    review_goals: { label: "Review savings goals", href: "/goals" },
    review_patterns: { label: "Review recurring patterns", href: "/#spending-title" },
    confirm_preferences: { label: "Confirm planning preferences", href: "/#financial-profile-title" },
  };
  const allowedInsights = ["spending", "variability", "categories", "recurring", "commitments", "goals", "buffer", "preference", "focus", "history_limit"].filter(id => facts[id] && !state.dismissedInsightIds.includes(id));
  const focusIds = preference?.focus === "goals" ? ["goals", "variability"] : preference?.focus === "commitments" ? ["commitments", "recurring"] : preference ? ["buffer", "goals"] : ["commitments", "goals"];
  const summaryId = full.length < 2 ? "summary_history" : financial.forecast.risk === "red" || financial.investable.investable <= 0 ? "summary_capacity" : Object.hasOwn(summaries,"summary_spending") ? "summary_spending" : "summary_plan";
  const preferredInsight = preference?.focus === "goals" && preferredGoal ? "focus" : preference?.focus === "cash_buffer" ? "preference" : preference?.focus === "commitments" ? "commitments" : null;
  const requiredInsightId = preferredInsight && allowedInsights.includes(preferredInsight) ? preferredInsight : null;
  const historical = ["spending","variability","categories"].filter(id=>allowedInsights.includes(id));
  const historyRequired = full.length >= 2 && historical.length > 0;
  let insightIds = [...new Set([...(requiredInsightId?[requiredInsightId]:[]),...focusIds,"history_limit","variability",...allowedInsights])].filter(id=>allowedInsights.includes(id)).slice(0,2);
  if(historyRequired && summaryId!=="summary_spending" && !insightIds.some(id=>historical.includes(id))) insightIds=[...new Set([...(requiredInsightId?[requiredInsightId]:insightIds.slice(0,1)),historical[0]])].slice(0,2);
  const fallback: ProfileSelection = {
    summaryId, insightIds,
    actionId: preference?.focus === "goals" ? "review_goals" : financial.forecast.risk !== "green" ? "review_cash" : preference ? "review_patterns" : "confirm_preferences",
  };
  return { asOf: financial.asOf, coverage, fullMonthCount: full.length, averageMonthlyCents: spending?.analysis.averageMonthlyCents ?? null, facts, summaries, actions, allowedInsights, fallback,
    historyRequired, requiredInsightId,
    summaryRequired: full.length < 2 || financial.forecast.risk === "red" || financial.investable.investable <= 0,
    commitmentCount: commitments.length,
    activeGoals: activeGoals.map(goal => ({ id: goal.id, name: goal.name })), engineBufferCents: cents(financial.persona.buffer), preferredGoalId: preferredGoal?.id ?? null };
}
export function profileBasis(owner: string, data: StoreData = load()) {
  if (!data.personas[owner]) throw new CheckoutError("NOT_FOUND", "Financial profile not found", 404);
  const state = data.personas[owner].financialProfile || emptyState();
  const financial = snapshot(owner, data);
  const spending = demoEnabled() ? spendingView(owner, data) : null;
  const features = extractProfileFeatures(financial, spending, state);
  const financialHash = inputHash(owner, data);
  const basisHash = crypto.createHash("sha256").update(JSON.stringify({ owner, financialHash, spendingVersion: spending?.version ?? null, preferences: state.preferences, dismissed: state.dismissedInsightIds, features, policy: "financial-profile-v1" })).digest("hex");
  return { state, financial, features, financialHash, basisHash };
}
