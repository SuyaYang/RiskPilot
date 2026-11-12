import type { OrderRecord, StoreData } from "./store";

/** Immutable capture-time snapshots, not a reconstruction from today's mutable profile. */
export function captureComparison(order:OrderRecord, store:StoreData) {
  if(order.status!=="CAPTURED")return null;
  const saved=order.snapshotId?store.snapshots[order.snapshotId]:null;
  if(!saved || saved.personaId!==order.personaId || saved.orderId!==order.orderId || !saved.before)
    return {available:false as const,reason:"This earlier payment has no saved before-purchase snapshot. Its existing payment and saved forecast are preserved."};
  const before=saved.before,after=saved.data;
  if(before.asOf!==after.asOf)return {available:false as const,reason:"The snapshot dates differ. A same-date before/after comparison is unavailable."};
  const goalChanges=after.allocation.goals.flatMap(goal=>{
    const previous=before.allocation.goals.find(item=>item.goalId===goal.goalId);
    if(!previous || (previous.eta===goal.eta && previous.status===goal.status && previous.allocatedThisMonth===goal.allocatedThisMonth))return [];
    return [{id:goal.goalId,name:goal.name,beforeDate:previous.eta,afterDate:goal.eta,beforeStatus:previous.status,afterStatus:goal.status,beforeMonthly:previous.allocatedThisMonth,afterMonthly:goal.allocatedThisMonth}];
  });
  return {available:true as const,asOf:after.asOf,savedAt:saved.createdAt,
    buffer:after.persona.buffer,
    before:{forecast:before.forecast,availableToAllocate:before.investable.investable},
    after:{forecast:after.forecast,availableToAllocate:after.investable.investable},goalChanges};
}
export type CaptureComparison=ReturnType<typeof captureComparison>;
