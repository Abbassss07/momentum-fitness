import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Terms of Use | Momentum",
  description: "Terms for using Momentum, a personal fitness journal.",
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Use">
      <p className="legal-updated">Last updated: September 3, 2026</p>
      <p className="legal-intro">
        These terms govern your use of Momentum. By creating an account or using Momentum, you agree to these terms and to the Privacy Policy.
      </p>

      <LegalSection title="Momentum is a fitness journal">
        <p>Momentum helps you record workouts, body weight, and progress. It is not medical, nutritional, rehabilitation, or professional training advice. Consult an appropriately qualified professional before starting or changing an exercise, health, or nutrition program.</p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>You are responsible for keeping your sign-in credentials secure and for activity performed through your account. Provide accurate account information, choose a unique username, and notify the Momentum operator promptly if you believe your account has been accessed without permission.</p>
      </LegalSection>

      <LegalSection title="Your content and records">
        <p>You retain responsibility for the information you enter into Momentum. You give Momentum the limited permission needed to store, process, display, and transmit that information solely to operate the service and the features you choose to use.</p>
      </LegalSection>

      <LegalSection title="Friends and groups">
        <p>Friends and groups are optional. Use invite links carefully and only invite people you trust. Group membership is separate from friendship and only supports the relevant group leaderboards. Group owners are responsible for approving requests, managing members, and sharing invitations appropriately.</p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Do not use Momentum to harass others, impersonate another person, interfere with the service, try to bypass access controls, collect other users&apos; data without permission, or upload information that is unlawful or infringes someone else&apos;s rights.</p>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>We may update, maintain, suspend, or discontinue parts of Momentum to improve the service, address security issues, or meet legal obligations. We may also update these terms. The date at the top shows when they were last revised.</p>
      </LegalSection>

      <LegalSection title="Disclaimers and liability">
        <p>Momentum is provided on an “as available” basis. To the extent permitted by applicable law, we do not guarantee uninterrupted, error-free, or fitness-outcome-specific use of the service. Nothing in these terms limits rights that cannot legally be limited.</p>
      </LegalSection>
    </LegalLayout>
  );
}

function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
