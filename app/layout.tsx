import "./globals.css";
import type { Metadata } from "next";
import Nav from "./components/Nav";
import localFont from "next/font/local";

const inter = localFont({ src: "./fonts/InterVariable.ttf", variable: "--font-inter", display: "swap", weight: "100 900" });

export const metadata: Metadata = {
  title: "RiskPilot Checkout",
  description: "Find a way to pay with PayPal that you can afford, without derailing your goals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <Nav />
        <div className="environment-bar"><span className="environment-dot" />Sandbox demo · Fictional finances</div>
        <main>{children}</main>
        <footer>
          <span className="footer-brand">RiskPilot<span>.</span></span><p>Independent demo using PayPal Sandbox · Fictional people and financial data.<br />Investing content is educational only. No real funds are moved.</p>
        </footer>
      </body>
    </html>
  );
}
