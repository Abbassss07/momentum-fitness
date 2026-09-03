import Link from "next/link";
import type { ReactNode } from "react";
import { TrendingUp } from "lucide-react";

export function LegalLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link href="/" className="legal-brand" aria-label="Momentum home">
          <span className="brand-mark" aria-hidden="true"><TrendingUp size={17} /></span>
          <span>Momentum</span>
        </Link>
        <Link href="/" className="text-button">Return to Momentum</Link>
      </header>

      <article className="legal-content">
        <p className="section-label">Legal</p>
        <h1>{title}</h1>
        {children}
      </article>

      <footer className="legal-footer">
        <span>© {new Date().getFullYear()} Momentum</span>
        <span>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </span>
      </footer>
    </main>
  );
}
