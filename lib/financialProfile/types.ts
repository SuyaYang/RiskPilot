export type ProfileFocus = "cash_buffer" | "goals" | "commitments";
export type ProfilePreferences = { planningBufferCents: number; priorityGoalId: string | null; focus: ProfileFocus; confirmedAt: string };
export type ProfileSelection = { summaryId: string; insightIds: string[]; actionId: string };
export type FinancialProfileState = {
  version: number; preferences?: ProfilePreferences; dismissedInsightIds: string[]; dismissed?: boolean;
  generated?: ProfileSelection & { basisHash: string; source: "ai" | "template"; generatedAt: string };
};
export type ProfileFact = { text: string; shortText?: string; kind: "observed" | "predicted" | "user_confirmed" | "limitation"; source: string; period: string };
