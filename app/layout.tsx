import "./globals.css";
import type { Metadata } from "next";
import Nav from "./components/Nav";

export const metadata: Metadata = {
  title: "RiskPilot Checkout",
  description: "Find a way to pay with PayPal that you can afford, without derailing your goals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
        <footer>
          Demo with fictional people and data. Payments run in PayPal Sandbox. Investing content is educational only and is not
          financial advice.
        </footer>
      </body>
    </html>
  );
}
