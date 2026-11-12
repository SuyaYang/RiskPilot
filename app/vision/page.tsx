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

const conceptPaths = {
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  trophy: "M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-4 1h8",
  bank: "m3 8 9-5 9 5H3Zm2 3v7m5-7v7m4-7v7m5-7v7M3 21h18",
  home: "m3 10 9-7 9 7v11h-7v-7h-4v7H3V10Z",
  transfer: "M8 20V4m-5 5 5-5 5 5m3-5v16m-5-5 5 5 5-5",
  person: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  qr: "M3 3h6v6H3V3Zm12 0h6v6h-6V3ZM3 15h6v6H3v-6Zm12 0h2v2h-2v-2Zm6 0v3h-3v3h-3m6 0h.01",
};

function ConceptIcon({ name, size = 20 }: { name: keyof typeof conceptPaths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={conceptPaths[name]} /></svg>;
}

export default function VisionPage() {
  return (
    <main className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand} aria-label="Back to RiskPilot Dashboard" prefetch={false}>
            <span className={styles.brandMark}><Icon name="chart" size={21} /></span>
            RiskPilot<span className={styles.period}>.</span>
          </Link>
          <span className={styles.edition}>A vision for the PayPal ecosystem <span className={styles.conceptTag}>CONCEPT / 01</span></span>
        </header>

        <section className={styles.hero} aria-labelledby="vision-title">
          <div className={styles.story}>
            <p className={styles.eyebrow}><span />THE NEXT CHAPTER</p>
            <h1 id="vision-title">Beyond payments.<br /><span>Toward financial<br className={styles.desktopBreak} /> intelligence.</span></h1>
            <p className={styles.intro}>Imagine a PayPal experience that helps people understand their money, plan what’s ahead, and make informed decisions before they pay.</p>
            <div className={styles.manifesto}><span className={styles.rule} /><p>Financial clarity.<br /><strong>Before the moment of payment.</strong></p></div>
          </div>

          <figure className={styles.concept} aria-label="Future PayPal-inspired Accounts screen. All identity, linked accounts and financial figures are fictional; static concept only.">
            <div className={styles.orbit} aria-hidden="true" />
            <div className={styles.conceptLabel}><span /> FUTURE PAYPAL EXPERIENCE CONCEPT</div>
            <div className={styles.phone}>
              <div className={styles.hardware} aria-hidden="true">
                <span>9:41</span><i /><span className={styles.statusIcons}>
                  <svg width="14" height="11" viewBox="0 0 14 11"><path d="M1 10V7m4 3V5m4 5V3m4 7V1" stroke="currentColor" strokeWidth="2" /></svg>
                  <svg width="13" height="11" viewBox="0 0 13 11"><path d="M1 3a9 9 0 0 1 11 0M3 6a5 5 0 0 1 7 0M5 9a2 2 0 0 1 3 0" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
                  <span className={styles.battery} />
                </span>
              </div>
              <div className={styles.screen}>
                <div className={styles.profileHeader}><p>Alex Morgan</p><span className={styles.notification}><ConceptIcon name="bell" size={18} /><i /></span></div>
                <div className={styles.accountTabs} aria-label="Illustrative account tabs, Accounts selected"><span className={styles.activeTab}>Accounts</span><span>Activity</span><span>Subscriptions</span><span>Settings</span></div>
                <div className={styles.rewards}><div><span>Rewards</span><p><strong>0</strong> Points</p></div><span className={styles.trophy}><ConceptIcon name="trophy" size={24} /></span></div>

                <div className={styles.financialCard}>
                  <div className={styles.insightHeader}><div><h2>Financial insights</h2><p>Powered by RiskPilot</p></div><span className={styles.miniMark}><Icon name="chart" size={18} /></span></div>
                  <div className={styles.allocation}>
                    <p>Available to allocate</p>
                    <div><strong>$122</strong><span><s>$90</s> before</span></div>
                    <span className={styles.estimate}>Illustrative planning estimate</span>
                  </div>
                  <div className={styles.outlook}>
                    <div className={styles.outlookTitle}><span>Cash outlook</span><span>45 days</span></div>
                    <svg viewBox="0 0 260 63" role="img" aria-label="Illustrative cash outlook sparkline, not retrieved PayPal or bank data">
                      <path d="M0 16H260M0 45H260" stroke="currentColor" strokeOpacity=".12" strokeDasharray="3 4" />
                      <path d="M2 11 27 18 48 16 69 31 89 28 111 41 131 34 151 45 171 22 190 29 215 17 237 23 258 9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                      <circle cx="151" cy="45" r="4" fill="white" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    <div className={styles.minimum}><span>Lowest projected cash</span><strong><s>$1,720</s> $1,738</strong></div>
                  </div>
                  <div className={styles.assumption}><span>Shopping budget / month</span><strong><s>$90</s><Icon name="arrow" size={13} /><b>$30</b></strong></div>
                  <div className={styles.insight}><Icon name="spark" size={14} /><p>A smaller shopping budget leaves more room for your financial goals.</p></div>
                  <div className={styles.planPreview}>Review your money plan<Icon name="arrow" size={15} /></div>
                </div>

                <div className={styles.linkedAccounts}><div className={styles.linkedTitle}><span>Linked banks and cards</span><span aria-hidden="true">+</span></div><div className={styles.bankRow}><span className={styles.bankIcon}><ConceptIcon name="bank" size={18} /></span><p>Demo Bank<span>Checking ••4821 · Illustrative</span></p><span className={styles.bankChevron} aria-hidden="true">›</span></div></div>
                <div className={styles.phoneNav} aria-label="Illustrative navigation, Me selected. Not interactive.">
                  <div className={styles.navPill}><span><ConceptIcon name="home" size={19} /><span>Home</span></span><span><ConceptIcon name="transfer" size={19} /><span>Send</span></span><span className={styles.selectedNav}><ConceptIcon name="person" size={19} /><span>Me</span></span></div>
                  <span className={styles.qrAction}><ConceptIcon name="qr" size={22} /><span className={styles.srOnly}>QR code concept action</span></span>
                </div>
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
