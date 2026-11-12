export const INCOME_FREQUENCIES = ["monthly", "biweekly", "quarterly", "once"] as const;
export type IncomeFrequency = typeof INCOME_FREQUENCIES[number];
export type PlanningIncomeEntry = {
  id: string; name: string; amountCents: number; currency: "USD"; frequency: IncomeFrequency;
  nextDate: string; status: "draft" | "confirmed" | "paused";
  sourceType: "user_entered" | "hypothetical"; reliability: "expected" | "uncertain";
  forecastMapping?: { kind: "additional" } | { kind: "replace"; modeledItemId: string; modeledSignature: string };
  confirmedForecast?: {
    name: string; amountCents: number; currency: "USD"; frequency: IncomeFrequency; nextDate: string;
    sourceType: "user_entered" | "hypothetical"; reliability: "expected" | "uncertain"; confirmedAt: string;
    forecastMapping: { kind: "additional" } | { kind: "replace"; modeledItemId: string; modeledSignature: string };
  };
  createdAt: string; updatedAt: string; confirmedAt: string | null; version: number;
};
/** Versioned user-entered expectations; only explicitly compiled mappings become model inputs. Never observed cash. */
export type PlanningIncomeState = {
  schemaVersion: 1; version: number; epoch: string; entries: Record<string, PlanningIncomeEntry>;
};
