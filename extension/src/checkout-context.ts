export type FundingMethod = "full" | "pay_in_4" | "pay_monthly" | "unknown";
export interface CheckoutContext {
  amount: number | null;
  currency: "USD" | "unconfirmed" | "unsupported";
  funding: FundingMethod;
}

/** Only use the order total or the explicit pay-in-full amount, never a loan installment. */
export function parseTotal(text: string): { amount: number; explicitUsd: boolean } | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (/\b(?:CAD|AUD|NZD|SGD|HKD|EUR|GBP|JPY|CNY)\b|(?:CA|AU|NZ|SG|HK)\$|[€£¥]/i.test(normalized)) return null;
  const values = [...normalized.matchAll(/(?:\bUSD\s*|US\s*\$\s*|\$\s*)(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+(?:\.\d{2})?)(?![\d.,])/gi)];
  const amounts = new Set(values.map(value => Number(value[1].replaceAll(",", ""))));
  if (amounts.size !== 1) return null;
  const amount = [...amounts][0];
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) return null;
  return { amount, explicitUsd: /\bUSD\b|US\s*\$/i.test(normalized) };
}

export function fundingFromLabel(text: string): FundingMethod {
  if (/pay\s+in\s+4/i.test(text)) return "pay_in_4";
  if (/pay\s+monthly/i.test(text)) return "pay_monthly";
  if (/pay\s+in\s+full/i.test(text)) return "full";
  return "unknown";
}

const label = (node: Element) => `${node.getAttribute("aria-label") ?? ""} ${node.textContent ?? ""}`.trim();
const unsupportedCurrency = (text: string) => /\b(?:CAD|AUD|NZD|SGD|HKD|EUR|GBP|JPY|CNY)\b|(?:CA|AU|NZ|SG|HK)\$|[€£¥]/i.test(text);

/** Read narrowly scoped order/method labels. No account, card, address, input or cookie reads. */
export function readCheckoutContext(root: Pick<Document, "querySelectorAll">): CheckoutContext {
  const buttons = [...root.querySelectorAll("button")];
  const totals = buttons.map(label).filter(text => /\bOrder(?:\s+details)?\b|订单(?:详情)?/i.test(text));
  const full = [...root.querySelectorAll('#id-pay-in-full-action, [role="checkbox"], [role="radio"]')]
    .map(label).filter(text => /pay\s+in\s+full/i.test(text));
  const candidates = totals.some(text => /[$€£¥]|\bUSD\b/i.test(text) || unsupportedCurrency(text)) ? totals : full;
  const unsupported = candidates.some(unsupportedCurrency);
  const parsed = candidates.map(parseTotal).filter((x): x is NonNullable<typeof x> => x !== null);
  const distinct = new Set(parsed.map(x => x.amount));
  // Conflicting totals are unknown. Never fall back to the smaller installment amount.
  const total = !unsupported && distinct.size === 1 ? parsed[0] : null;
  const selected = [...root.querySelectorAll('[role="checkbox"][aria-checked="true"], [role="radio"][aria-checked="true"], input:checked')]
    .map(label).map(fundingFromLabel).filter(x => x !== "unknown");
  return {
    amount: total?.amount ?? null,
    currency: unsupported ? "unsupported" : total?.explicitUsd ? "USD" : "unconfirmed",
    funding: new Set(selected).size === 1 ? selected[0] : "unknown",
  };
}
