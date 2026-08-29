import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Momentum - Fitness Tracker",
  description: "Track your lifts, body weight, and progress over time.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

