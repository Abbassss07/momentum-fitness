import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegistration } from "@/components/PwaRegistration";

export const metadata: Metadata = {
  title: "Momentum - Fitness Tracker",
  description: "Track your lifts, body weight, and progress over time.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Momentum",
  },
};

export const viewport: Viewport = {
  themeColor: "#1b1e1a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-full">
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
