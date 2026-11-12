import "./globals.css";
import type { Metadata } from "next";
import AppShell from "./components/AppShell";
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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
