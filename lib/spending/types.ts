export const SPENDING_CATEGORIES = ["Housing and utilities", "Food and dining", "Shopping", "Transportation", "Subscriptions", "Health", "Entertainment", "Other", "Uncategorized"] as const;
export type SpendingCategory = typeof SPENDING_CATEGORIES[number];
export type SpendingFrequency = "weekly" | "biweekly" | "monthly";
export type Transaction = {
  id: string; ownerId: string; accountId: string; date: string;
  merchantName?: string; description: string;
  amountCents: number; // Positive outflow, negative credit; USD integer minor units.
  currency: "USD"; source: "local-sandbox-fixture";
  status: "posted" | "pending" | "reversed" | "removed";
  kind: "expense" | "income" | "internal_transfer" | "credit_card_payment" | "refund" | "reversal";
  category?: SpendingCategory;
  originalTransactionId?: string; pendingTransactionId?: string;
  recurringHint?: "housing" | "utility" | "subscription" | "membership" | "insurance";
  scheduledItemId?: string;
};
export type Coverage = { start: string; end: string; asOf: string; source: "local-sandbox-fixture" };
export type RecurringDecision = {
  status: "suggested" | "confirmed" | "rejected";
  merchant?: string; amountCents?: number; frequency?: SpendingFrequency; nextDate?: string | null;
};
export type SpendingPreferences = { version: number; decisions: Record<string, RecurringDecision> };
