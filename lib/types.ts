export type Frequency = "monthly" | "biweekly";

export interface RecurringItem {
  id: string;
  name: string;
  amount: number; // always positive
  direction: "in" | "out";
  frequency: Frequency;
  firstInDays: number; // days from today until the next occurrence
  uncertain?: boolean; // income that may arrive late (freelance invoices)
}

export type GoalType = "spend" | "invest";
export type Priority = 1 | 2 | 3; // 1 = high

export interface Goal {
  id: string;
  name: string;
  type: GoalType;
  targetAmount: number;
  targetDate: string; // ISO date
  savedSoFar: number;
  priority: Priority;
  paused?: boolean;
  version?: number;
}

export interface Persona {
  id: string;
  name: string;
  tagline: string;
  checkingBalance: number;
  savingsBalance: number;
  buffer: number;
  dailySpend: number;
  recurring: RecurringItem[];
  goals: Goal[];
}

export type MethodId = "full" | "pay_in_4" | "pay_monthly" | "cheaper" | "wait";

export interface Payment {
  date: string; // ISO date
  amount: number;
  label: string;
}

export interface Purchase {
  id: string; // capture id
  orderId: string;
  productName: string;
  amount: number;
  method: MethodId;
  payments: Payment[];
  capturedAt: string;
  fundingStatus: "UNCONFIRMED";
  simulated: boolean;
}

export interface ForecastResult {
  startBalance: number;
  dailyBalances: { date: string; balance: number }[];
  minBalance: number;
  minBalanceDate: string;
  bufferGap: number; // minBalance - buffer
  stressMinBalance: number;
  stressBufferGap: number;
  risk: "green" | "yellow" | "red";
  evaluatedThrough: string;
}

export interface GoalStatus {
  goalId: string;
  name: string;
  type: GoalType;
  priority: Priority;
  remaining: number;
  requiredMonthly: number;
  allocatedThisMonth: number;
  eta: string | null; // ISO date, null if not reached within horizon
  targetDate: string;
  status: "on_track" | "delayed" | "paused" | "done";
  delayDays: number; // vs target date (0 if on time)
}

export interface Allocation {
  monthlySurplus: number;
  goals: GoalStatus[];
}

export interface OptionResult {
  method: MethodId;
  label: string;
  productName: string;
  price: number;
  eligible: boolean;
  ineligibleReason?: string;
  payments: Payment[];
  extraCost: number; // interest, estimate
  forecast: ForecastResult;
  goalImpact: { goalId: string; name: string; delayDays: number }[];
  responsible: { ok: boolean; reasons: string[] };
  recommended: boolean;
  hypothetical: boolean;
}

export interface Decision {
  id: string;
  personaId: string;
  productId: string;
  createdAt: string;
  inputHash: string;
  schemaVersion: "rp-v1";
  baseline: ForecastResult;
  options: OptionResult[];
  recommendedMethod: MethodId;
  explanation?: { text: string; source: "ai" | "template" };
}
