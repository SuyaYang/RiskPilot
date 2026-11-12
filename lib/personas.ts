import type { Persona } from "./types";
import { addDays, iso, today } from "./dates";

/** Demo personas. All people and numbers are fictional. Goal dates are relative to today. */
export function buildPersonas(): Persona[] {
  const t = today();
  const inDays = (n: number) => iso(addDays(t, n));
  return [
    {
      id: "alex",
      name: "Alex",
      tagline: "Salaried, rent due next week",
      checkingBalance: 3500,
      savingsBalance: 2000,
      buffer: 1000,
      dailySpend: 20,
      recurring: [
        { id: "a-pay", name: "Paycheck", amount: 1500, direction: "in", frequency: "biweekly", firstInDays: 9 },
        { id: "a-rent", name: "Rent", amount: 1600, direction: "out", frequency: "monthly", firstInDays: 5 },
        { id: "a-card", name: "Credit card payment", amount: 300, direction: "out", frequency: "monthly", firstInDays: 25 },
        { id: "a-phone", name: "Phone", amount: 60, direction: "out", frequency: "monthly", firstInDays: 18 },
        { id: "a-subs", name: "Subscriptions", amount: 40, direction: "out", frequency: "monthly", firstInDays: 12 },
      ],
      goals: [
        { id: "a-trip", name: "Japan trip", type: "spend", targetAmount: 2500, savedSoFar: 1500, targetDate: inDays(125), priority: 1 },
        { id: "a-emergency", name: "Emergency fund", type: "spend", targetAmount: 3000, savedSoFar: 2000, targetDate: inDays(180), priority: 1 },
        { id: "a-invest", name: "Start investing", type: "invest", targetAmount: 1000, savedSoFar: 0, targetDate: inDays(60), priority: 3 },
      ],
    },
    {
      id: "sam",
      name: "Sam",
      tagline: "Comfortable savings, steady income",
      checkingBalance: 9000,
      savingsBalance: 12000,
      buffer: 2000,
      dailySpend: 35,
      recurring: [
        { id: "s-pay", name: "Paycheck", amount: 3000, direction: "in", frequency: "biweekly", firstInDays: 3 },
        { id: "s-rent", name: "Rent", amount: 2000, direction: "out", frequency: "monthly", firstInDays: 10 },
        { id: "s-card", name: "Credit card payment", amount: 600, direction: "out", frequency: "monthly", firstInDays: 20 },
        { id: "s-subs", name: "Subscriptions", amount: 80, direction: "out", frequency: "monthly", firstInDays: 7 },
      ],
      goals: [
        { id: "s-wedding", name: "Wedding", type: "spend", targetAmount: 15000, savedSoFar: 6000, targetDate: inDays(300), priority: 1 },
        { id: "s-invest", name: "Index fund contributions", type: "invest", targetAmount: 6000, savedSoFar: 0, targetDate: inDays(365), priority: 2 },
      ],
    },
    {
      id: "jordan",
      name: "Jordan",
      tagline: "Freelancer, irregular income",
      checkingBalance: 1400,
      savingsBalance: 300,
      buffer: 800,
      dailySpend: 15,
      recurring: [
        { id: "j-inv1", name: "Client invoice", amount: 2100, direction: "in", frequency: "monthly", firstInDays: 20, uncertain: true },
        { id: "j-rent", name: "Rent", amount: 1100, direction: "out", frequency: "monthly", firstInDays: 3 },
        { id: "j-ins", name: "Health insurance", amount: 250, direction: "out", frequency: "monthly", firstInDays: 14 },
        { id: "j-subs", name: "Software subscriptions", amount: 60, direction: "out", frequency: "monthly", firstInDays: 8 },
      ],
      goals: [
        { id: "j-emergency", name: "Emergency fund", type: "spend", targetAmount: 3000, savedSoFar: 300, targetDate: inDays(240), priority: 1 },
      ],
    },
  ];
}
