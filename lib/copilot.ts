import type { snapshot } from "./state";
import type { Decision } from "./types";
import { scheduledItems } from "./presentation";
import { conceptAnswer, CONCEPT_LIST } from "./ai";
const usd=(value:number)=>`USD ${value.toFixed(2)}`;

/** Allowlist: no API keys, workspace identifiers, provider logins or payment identifiers. */
export function copilotFacts(data:ReturnType<typeof snapshot>, decision?:Decision) {
  const {forecast:f,persona:p,investable:inv}=data;
  const facts:Record<string,string>={
    context:`These are fictional demo finances as of ${data.asOf}, not live bank data. The assistant cannot make payments or change records.`,
    balances:`Checking fixture: ${usd(p.checkingBalance)}. Savings fixture: ${usd(p.savingsBalance)}. Forecast starts at ${usd(f.startBalance)} after recorded purchase reserves.`,
    forecast:`The lowest projected cash is ${usd(f.minBalance)} on ${f.minBalanceDate}. Risk: ${f.risk}. Cash buffer: ${usd(p.buffer)}. The chart shows 45 days; risk evaluation extends through ${f.evaluatedThrough}.`,
    stress:`If income arrives one week late, lowest projected cash is ${usd(f.stressMinBalance)}; its gap to the cash buffer is ${usd(f.stressBufferGap)}.`,
    capacity:`Available to allocate: ${usd(inv.investable)}. This month's protected spending-goal reserve: ${usd(inv.reservedForGoals)}. This is engine-calculated capacity, not a recommendation or transfer.`,
    allocation:`The engine allocates monthly surplus of ${usd(data.allocation.monthlySurplus)} across goal priorities. Editing a goal changes its plan and does not move money. Contribution-increase cash-flow simulations are not implemented.`,
    assumptions:"The forecast uses fictional recurring bills, everyday spending, income and recorded purchase reserves. It does not provide a calculated per-expense causal attribution.",
  };
  inv.checks.forEach((check,index)=>{facts[`check_${index}`]=`${check.label}: ${check.ok ? "Pass" : "Hold"}.`;});
  const events=scheduledItems(p.recurring,data.upcomingPayments,data.asOf);
  facts.commitments=events.length ? "Scheduled outflows in the chart window: " + events.map(item=>`${item.date}: ${item.label}, ${usd(item.amount)} (${item.source})`).join("; ")+". Income and everyday spending are separate forecast inputs." : "No scheduled bill or purchase-reserve outflows were returned in the next 45 days.";
  const largest=events.reduce<(typeof events)[number]|undefined>((max,item)=>!max||item.amount>max.amount?item:max,undefined);
  if(largest)facts.largest=`The largest scheduled outflow in the next 45 days is ${largest.label}: ${usd(largest.amount)} on ${largest.date} (${largest.source}).`;
  facts.goals=data.goals.length?"There are saved goals; individual progress and predicted dates are listed in the goal facts.":"No goals have been saved yet. Add a goal on the Goals page to generate a plan.";
  data.goals.forEach((goal,index)=>{
    const plan=data.allocation.goals.find(item=>item.goalId===goal.id);
    facts[`goal_${index}`]=`${goal.name}: manually saved ${usd(goal.savedSoFar)} toward ${usd(goal.targetAmount)}. Target date ${goal.targetDate}. ${goal.paused?"Paused.":`Engine status ${plan?.status||"unknown"}; predicted completion ${plan?.eta||"not projected"}; monthly allocation ${plan?usd(plan.allocatedThisMonth):"unknown"}.`}`;
  });
  CONCEPT_LIST.forEach(concept=>{facts[`learn_${concept.id}`]=conceptAnswer(concept.id)!;});
  if(decision) {
    decision.options.forEach(option=>{
      const key=`purchase_${option.method}`;
      facts[key]=`${option.label}, ${option.productName}: ${usd(option.price)}. ${option.hypothetical?"Hypothetical estimate; PayPal determines eligibility and actual terms.":option.method==="wait"?"No purchase or checkout.":"Full-price scenario; checkout eligibility is determined separately."} Lowest projected cash ${usd(option.forecast.minBalance)} on ${option.forecast.minBalanceDate}; risk ${option.forecast.risk}; buffer gap ${usd(option.forecast.bufferGap)}. Estimated extra cost ${usd(option.extraCost)}.`;
      facts[`${key}_stress`]=`${option.label}: lowest projected cash if income is one week late is ${usd(option.forecast.stressMinBalance)}.`;
      facts[`${key}_goals`]=`${option.label}: `+(option.goalImpact.some(goal=>goal.delayDays>0)?option.goalImpact.filter(goal=>goal.delayDays>0).map(goal=>`${goal.name} adds ${goal.delayDays} days versus no purchase`).join("; "):"no extra projected goal delay versus no purchase")+".";
    });
  }else facts.purchase="No current purchase assessment was supplied. Choose a product on Shop and assess it before asking about its affordability. A purchase delayed to a specific date is not simulated.";
  return facts;
}
