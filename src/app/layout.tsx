import type { Metadata } from "next";
import "./globals.css";
import "./integrations.css";
import "./phase-three.css";
import "./phase-four.css";
import "./phase-five.css";

export const metadata: Metadata = {
  title: "RecoverAI · Bounded Revenue Recovery",
  description: "Auditable AI revenue recovery for Razorpay AI Buildathon 2026",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
