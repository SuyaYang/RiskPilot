import type { Metadata } from "next";
import Link from "next/link";
import Icon from "../components/Icon";
import styles from "./vision.module.css";

export const metadata: Metadata = {
  title: "RiskPilot — The next chapter",
  description: "A future concept for financial intelligence in the PayPal ecosystem. Not an official PayPal interface.",
};

const opportunities = [
  ["More reasons to return", "From a payment destination to an ongoing financial planning experience."],
  ["Greater trust at checkout", "Help people understand the financial consequences before they commit."],
  ["More personalized engagement", "Connect spending insights, goals, and future cash-flow planning."],
];

export default function VisionPage() {
  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand} aria-label="Back to RiskPilot Dashboard" prefetch={false}>
            <span className={styles.brandMark}><Icon name="chart" size={21} /></span>
            RiskPilot<span className={styles.period}>.</span>
          </Link>
          <span className={styles.edition}>A vision for the PayPal ecosystem <span> / 01</span></span>
        </header>

        <section className={styles.hero} aria-labelledby="vision-title">
          <div className={styles.story}>
            <p className={styles.eyebrow}><span />THE NEXT CHAPTER</p>
            <h1 id="vision-title">Beyond payments.<br /><span>Toward financial<br className={styles.desktopBreak} /> intelligence.</span></h1>
            <p className={styles.intro}>Imagine a PayPal experience that helps people understand their money, plan what’s ahead, and make informed decisions before they pay.</p>
            <div className={styles.manifesto}><span className={styles.rule} /><p>Financial clarity.<br /><strong>Before the moment of payment.</strong></p></div>
          </div>

          <figure className={styles.concept} aria-label="Static financial insights concept with illustrative demo figures">
            <div className={styles.orbit} aria-hidden="true" />
            <div className={styles.conceptLabel}><span /> EMBEDDED INTELLIGENCE CONCEPT</div>
            <div className={styles.phone}>
              <div className={styles.hardware} aria-hidden="true"><span>9:41</span><i /><span className={styles.statusIcons}><b /><b /><b /></span></div>
              <div className={styles.screen}>
                <div className={styles.insightHeader}><span className={styles.miniMark}><Icon name="chart" size={18} /></span><div><h2>Financial insights</h2><p>Powered by RiskPilot</p></div><Icon name="spark" size={19} /></div>
                <p className={styles.phoneHeadline}>See the plan.<br />Then the possibility.</p>
                <div className={styles.allocation}>
                  <p>Available to allocate</p>
                  <div><strong>$122</strong><span><s>$90</s> before</span></div>
                  <span className={styles.estimate}>Illustrative 45-day planning estimate</span>
                </div>
                <div className={styles.outlook}>
                  <div className={styles.outlookTitle}><span>Cash outlook</span><span>45 days</span></div>
                  <svg viewBox="0 0 260 63" role="img" aria-label="Illustrative cash outlook, not live data">
                    <path d="M0 16H260M0 45H260" stroke="#e8ebef" strokeDasharray="3 4" />
                    <path d="M2 11 27 18 48 16 69 31 89 28 111 41 131 34 151 45 171 22 190 29 215 17 237 23 258 9" fill="none" stroke="#0070e0" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                    <circle cx="151" cy="45" r="4" fill="#fff" stroke="#0070e0" strokeWidth="2" />
                  </svg>
                  <div className={styles.minimum}><span>Lowest projected cash</span><strong><s>$1,720</s> $1,738</strong></div>
                </div>
                <div className={styles.assumption}><span>Shopping budget / month</span><strong><s>$90</s><Icon name="arrow" size={14} />$30</strong></div>
                <div className={styles.insight}><Icon name="spark" size={15} /><p>A smaller shopping budget leaves more room in this illustrative plan.</p></div>
                <div className={styles.planPreview}>Review your money plan<Icon name="arrow" size={17} /></div>
              </div>
              <div className={styles.homeIndicator} aria-hidden="true" />
            </div>
            <figcaption>Illustrative demo scenario <span>·</span> Static concept</figcaption>
          </figure>
        </section>

        <section className={styles.opportunities} aria-label="Potential PayPal ecosystem opportunities">
          {opportunities.map(([title, copy], index) => <article key={title}>
            <span className={styles.index}>0{index + 1}</span><div><h2>{title}</h2><p>{copy}</p></div>
          </article>)}
        </section>

        <section className={styles.disclosure} aria-label="Current implementation and future concept">
          <p className={styles.conceptNotice}>Future concept ·<br /><strong>Not an official PayPal interface</strong></p>
          <p><span>TODAY</span>RiskPilot works alongside PayPal Checkout through a merchant-integrated Sandbox prototype.</p>
          <p><span>FUTURE</span>With appropriate platform integrations and user permissions, similar financial intelligence could be embedded more directly into the PayPal experience.</p>
        </section>
      </div>
    </main>
  );
}
