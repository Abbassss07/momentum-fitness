import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy | Momentum",
  description: "How Momentum handles account, training, friend, and group data.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p className="legal-updated">Last updated: September 3, 2026</p>
      <p className="legal-intro">
        Momentum is a personal fitness journal. This policy explains the data used to provide your
        account, training records, and the optional friend and group features.
      </p>

      <LegalSection title="Information Momentum processes">
        <ul>
          <li><strong>Account information:</strong> your email address, username, display name, and authentication details.</li>
          <li><strong>Training records:</strong> exercises, dates, load, sets, repetitions, notes, custom exercises, and your personal library preferences.</li>
          <li><strong>Body-weight records:</strong> the dates and values you log.</li>
          <li><strong>Social and group data:</strong> friend requests, group names, invite codes, memberships, join requests, and direct invites.</li>
          <li><strong>Service information:</strong> the technical information needed by our hosting and authentication providers to deliver and protect the service.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Why we use this information">
        <p>We use your information to operate Momentum, show your training progress, maintain your account and preferences, provide friend and group features you choose to use, protect the service from misuse, and respond to support or legal requests.</p>
      </LegalSection>

      <LegalSection title="Who can see your training data">
        <p>Your records are private to your account by default. Choosing to use social features changes visibility only as described below:</p>
        <ul>
          <li>Accepted friends can view the information made available through Momentum&apos;s friend features.</li>
          <li>Group membership does not create a friendship. Group members receive only the workout inputs needed for that group&apos;s Volume and Consistency leaderboards.</li>
          <li>Groups do not provide access to a member&apos;s full workout history, friend-profile view, or body-weight records.</li>
          <li>Invite links allow a person to request access to a group; the group owner must approve a link-based request. Direct invites can be accepted or declined by the invited person.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Service providers">
        <p>Momentum uses service providers to host the application and provide authentication and database services. They process data only as needed to provide those services and keep Momentum available and secure.</p>
      </LegalSection>

      <LegalSection title="Your choices">
        <p>You can update your profile, change your password, edit or delete your individual workout and body-weight entries, remove exercises from your library, manage friendships and groups, and leave or decline social invitations using the controls available in the app.</p>
      </LegalSection>

      <LegalSection title="Retention and security">
        <p>We retain account and journal information while your account remains active and as needed to operate the service, resolve issues, and meet applicable obligations. We use access controls designed to limit data access, but no online service can guarantee absolute security.</p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>We may update this policy when Momentum or applicable requirements change. The date at the top shows when it was last revised. Continued use after an update means you acknowledge the revised policy.</p>
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
