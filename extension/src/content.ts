import { readCheckoutContext, type CheckoutContext } from "./checkout-context";
import { assessExternalPurchase } from "./impact";
import type { MethodId } from "../../lib/types";

// This bundle runs only in Sandbox checkout, in Chrome's isolated content-script world.
// It never calls payment APIs, reads credentials, or clicks/blocks/relabels PayPal's controls.
const HOST_ID = "riskpilot-sandbox-impact";
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const date = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
let host: HTMLElement | null = null;
let root: ShadowRoot;
let persona = "sam";
let scenario: MethodId = "full";
let expanded = false;
let usdConfirmed = false;
let signature = "";
let previousFunding: CheckoutContext["funding"] = "unknown";
let previousAmount: number | null = null;
let observer: MutationObserver;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function render(context: CheckoutContext) {
  root.replaceChildren();
  const style = el("style");
  style.textContent = `
    :host{display:block!important;width:100%!important;flex-basis:100%;margin:12px 0;min-width:0;color:#172338;font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left}
    *{box-sizing:border-box}button,select{font:inherit}button{cursor:pointer}button:focus-visible,select:focus-visible{outline:3px solid #2876d9;outline-offset:2px}
    .card{background:#f5f9ff;border:1px solid #c3d5eb;border-radius:14px;padding:12px;max-height:43vh;overflow:auto}
    .head,.row{display:flex;align-items:center;justify-content:space-between;gap:8px}.brand{font-weight:750;color:#174b7d}.hint{font-size:11px;color:#516176;margin:4px 0}
    .toggle{background:white;border:1px solid #c3d5eb;border-radius:7px;padding:4px 8px;color:#174b7d}.title{font-size:14px;font-weight:700;margin:6px 0}
    .metrics{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px}.metric{font-size:11px;color:#516176}.value{display:block;font-size:18px;color:#172338;font-weight:750;white-space:nowrap}
    .green{color:#316a34}.red{color:#a02d27}.warning{color:#805000}.risk{font-size:12px;font-weight:650;margin:6px 0}
    .tabs{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.tabs button{border:1px solid #c3d5eb;border-radius:8px;padding:5px 8px;color:#174b7d;background:white}.tabs button[aria-pressed=true]{background:#dceaff;border-color:#2464ac}
    select{padding:3px;max-width:100%;border:1px solid #c3d5eb;border-radius:5px;background:white}p{margin:6px 0}details{margin:6px 0}summary{cursor:pointer}ul{padding-left:18px;margin:4px 0}.foot{border-top:1px solid #d8e1ef;margin-top:8px;padding-top:6px;font-size:10px;color:#516176}
    @media(max-width:420px){.value{font-size:16px}.metric{font-size:10px}.card{padding:10px}}
  `;
  root.append(style);
  const card = el("section", undefined, "card");
  card.setAttribute("aria-label", "RiskPilot Sandbox purchase impact");
  const head = el("div", undefined, "head");
  head.append(el("span", "RiskPilot · before you pay", "brand"));
  const toggle = el("button", expanded ? "Less" : "Details", "toggle");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.addEventListener("click", () => { expanded = !expanded; render(context); root.querySelector<HTMLButtonElement>(".toggle")?.focus(); });
  head.append(toggle); card.append(head);
  card.append(el("p", "Independent extension prototype · fictional finances", "hint"));

  if (context.amount === null || context.currency === "unsupported") {
    card.append(el("p", context.currency === "unsupported" ? "This demo supports USD only. No impact calculated." : "Order total not available yet. Open PayPal Order details to reveal the total.", "warning"));
  } else if (context.currency !== "USD" && !usdConfirmed) {
    card.append(el("p", `PayPal shows ${money(context.amount)}. Confirm USD for this demo before calculating.`, "title"));
    const confirm = el("button", "Use USD for this Sandbox demo", "toggle");
    confirm.type = "button";
    confirm.addEventListener("click", () => { usdConfirmed = true; render(context); });
    card.append(confirm);
  } else {
    const assessment = assessExternalPurchase(context.amount, persona);
    const option = assessment.options.find(o => o.method === scenario) ?? assessment.options[0];
    const f = option.forecast;
    const delayed = option.goalImpact.filter(g => g.delayDays > 0);
    card.append(el("p", `Impact of this ${money(context.amount)} purchase`, "title"));
    const metrics = el("div", undefined, "metrics");
    for (const [label, value, tone] of [
      ["Lowest cash", money(f.minBalance), f.minBalance < 0 ? "red" : ""],
      [f.bufferGap < 0 ? "Below buffer" : "Above buffer", money(Math.abs(f.bufferGap)), f.bufferGap < 0 ? "red" : "green"],
      ["Goal delay", delayed.length ? `+${Math.max(...delayed.map(g => g.delayDays))} days` : "No change", delayed.length ? "warning" : "green"],
    ]) {
      const metric = el("div", label, "metric"); metric.append(el("strong", value, `value ${tone}`)); metrics.append(metric);
    }
    card.append(metrics);
    card.append(el("p", f.risk === "red" ? "This scenario breaks your cash buffer." : f.risk === "yellow" ? "Late income could break your buffer." : "Your buffer holds in this fictional scenario.", `risk ${f.risk === "red" ? "red" : f.risk === "yellow" ? "warning" : "green"}`));
    card.append(el("p", `${option.hypothetical ? "Estimated schedule" : "Full-price cash reserve"} · ${assessment.persona.name}'s demo profile`, "hint"));

    if (expanded) {
      const profileLabel = el("label", "Fictional profile: ");
      const select = el("select");
      for (const [id, name] of [["sam", "Sam · steady income"], ["alex", "Alex · rent due soon"], ["jordan", "Jordan · irregular income"]]) {
        const opt = el("option", name); opt.value = id; opt.selected = id === persona; select.append(opt);
      }
      select.addEventListener("change", () => { persona = select.value; render(context); });
      profileLabel.append(select); card.append(profileLabel);
      const tabs = el("div", undefined, "tabs"); tabs.setAttribute("aria-label", "Forecast scenarios only");
      for (const option of assessment.options.filter(o => o.eligible)) {
        const names: Record<string, string> = { full: "Full price", pay_in_4: "4 payments · estimate", pay_monthly: "12 months · estimate" };
        const tab = el("button", names[option.method]); tab.type = "button";
        tab.setAttribute("aria-pressed", String(scenario === option.method));
        tab.addEventListener("click", () => { scenario = option.method; render(context); }); tabs.append(tab);
      }
      card.append(tabs);
      const selectedFunding = { full: "Pay in full", pay_in_4: "Pay in 4", pay_monthly: "Pay Monthly", unknown: "not identified" }[context.funding];
      card.append(el("p", `Selected in PayPal: ${selectedFunding}. Comparison buttons only change this forecast.`, "hint"));
      card.append(el("p", `Lowest cash on ${date(f.minBalanceDate)}. Protected buffer ${money(assessment.persona.buffer)}. If income is one week late: ${money(f.stressMinBalance)}.`));
      for (const goal of delayed) card.append(el("p", `${goal.name}: about ${goal.delayDays} extra days versus skipping this purchase.`));
      if (option.hypothetical) card.append(el("p", scenario === "pay_monthly" ? "Hypothetical: 12 payments, 19.99% assumed APR, first payment in 30 days. Actual PayPal loan terms may differ." : "Hypothetical: four payments, two weeks apart, starting today. Actual dates and eligibility are set by PayPal.", "warning"));
      const dates = el("details"); dates.append(el("summary", "Projected payment dates"));
      const list = el("ul"); for (const payment of option.payments) list.append(el("li", `${date(payment.date)} · ${money(payment.amount)}`));
      dates.append(list); card.append(dates);
      card.append(el("p", `Evaluated through ${date(f.evaluatedThrough)}. Demo fixtures only; your RiskPilot account and bank are not connected.`, "hint"));
    }
  }
  card.append(el("div", "PayPal's original payment button remains below. RiskPilot does not submit or change your payment.", "foot"));
  root.append(card);
}

function refresh() {
  const checkoutPath = location.pathname === "/pay/checkout" || location.pathname === "/checkoutnow" || location.pathname === "/checkoutnow/";
  const cta = document.getElementById("one-time-cta");
  if (!checkoutPath || !cta || cta.tagName !== "BUTTON") { host?.remove(); host = null; signature = ""; return; }
  const context = readCheckoutContext(document);
  if (context.amount !== previousAmount) { usdConfirmed = false; previousAmount = context.amount; }
  if (context.funding !== previousFunding) {
    // Unknown monthly loan terms never silently replace the conservative full-price reserve.
    scenario = context.funding === "pay_in_4" ? "pay_in_4" : "full";
    previousFunding = context.funding;
  }
  const next = JSON.stringify(context);
  if (!host?.isConnected || host.nextElementSibling !== cta) {
    host?.remove();
    host = el("div"); host.id = HOST_ID;
    root = host.attachShadow({ mode: "closed" });
    // Disconnect for our own mutation, so mounting cannot trigger an observer feedback loop.
    observer.disconnect(); cta.before(host); observe(); signature = "";
  }
  if (next !== signature) { signature = next; render(context); }
}

let timer: ReturnType<typeof setTimeout> | undefined;
observer = new MutationObserver(() => {
  clearTimeout(timer); timer = setTimeout(refresh, 150);
});
function observe() { observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-checked", "aria-label"], characterData: true }); }
observe(); refresh();
window.addEventListener("pageshow", refresh);
