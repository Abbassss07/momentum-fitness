"use client";

import { FormEvent, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowRight, Check, TrendingUp } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (user: User) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailLinkBusy, setEmailLinkBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const emailLinkEnabled = process.env.NEXT_PUBLIC_EMAIL_LINK_LOGIN_ENABLED === "true";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      let result;

    if (mode === "signup") {
      const normalizedUsername = username.trim().toLowerCase();
      if (!/^[a-z][a-z0-9_]{2,23}$/.test(normalizedUsername)) {
        setError("Use 3-24 lowercase letters, numbers, or underscores. Start with a letter.");
        setBusy(false);
        return;
      }

      const availability = await supabase.rpc("is_username_available", {
        candidate: normalizedUsername,
      });
      if (availability.error) {
        setError(availability.error.message);
        setBusy(false);
        return;
      }
      if (!availability.data) {
        setError("That username is already taken.");
        setBusy(false);
        return;
      }

      result = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: normalizedUsername } },
      });
    } else {
      result = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
    }

    if (result.error) {
      setError(result.error.message);
    } else if (mode === "signup") {
      const session = result.data.session;
      if (session) {
        onAuthenticated(session.user);
      } else {
        setMessage("Check your email to confirm your account, then sign in.");
      }
    }
    } catch {
      setError("Could not connect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode: "signin" | "signup") {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  async function sendEmailLink() {
    setEmailLinkBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/send-login-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to process this request.");
      setMessage(payload.message ?? "Check your email for a sign-in link.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to process this request.");
    } finally {
      setEmailLinkBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-intro" aria-label="About Momentum">
        <div className="auth-intro-inner">
          <Brand />
          <div className="auth-intro-copy">
            <p className="section-label">Personal training journal</p>
            <h1>See the work you are putting in.</h1>
            <p>
              A calm place to record your training, follow your body weight,
              and notice progress over time.
            </p>
            <div className="auth-proof" aria-label="Momentum features">
              <div><span>Training</span><strong>Sets, reps and load</strong></div>
              <div><span>Progress</span><strong>Clear, useful trends</strong></div>
              <div><span>Privacy</span><strong>Only people you accept</strong></div>
            </div>
          </div>
          <p className="auth-intro-foot">Consistency, recorded simply.</p>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-box">
          <div className="auth-mobile-brand"><Brand /></div>
          <p className="section-label">Welcome</p>
          <h2>{mode === "signin" ? "Sign in to Momentum" : "Create your journal"}</h2>
          <p className="auth-supporting">
            {mode === "signin"
              ? "Continue where you left off."
              : "Create an account, then log your first exercise."}
          </p>

          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={mode === "signin" ? "active" : ""}
              disabled={busy || emailLinkBusy}
              onClick={() => changeMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={mode === "signup" ? "active" : ""}
              disabled={busy || emailLinkBusy}
              onClick={() => changeMode("signup")}
            >
              Create account
            </button>
          </div>

          <form onSubmit={submit} className="auth-form">
            {mode === "signup" ? (
              <label>
                Username
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value.toLowerCase())}
                  placeholder="your_username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  minLength={3}
                  maxLength={24}
                  pattern="[a-z][a-z0-9_]{2,23}"
                  aria-describedby="username-hint"
                  required
                />
                <small id="username-hint" className="field-hint">
                  3-24 characters. Letters, numbers, and underscores.
                </small>
              </label>
            ) : null}
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={6}
                required
              />
            </label>

            {error ? <div className="form-error" role="alert">{error}</div> : null}
            {message ? (
              <div className="form-success" role="status">
                <Check size={16} aria-hidden="true" />
                {message}
              </div>
            ) : null}

            <button className="primary-button auth-submit" disabled={busy || emailLinkBusy}>
              {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            {mode === "signin" && emailLinkEnabled ? (
              <button
                type="button"
                className="secondary-button auth-submit"
                disabled={busy || emailLinkBusy}
                onClick={() => void sendEmailLink()}
              >
                {emailLinkBusy ? "Sending sign-in link..." : "Email me a sign-in link"}
              </button>
            ) : null}
          </form>

          <p className="privacy-note">
            By continuing, you agree to Momentum&apos;s <Link href="/terms">Terms of Use</Link> and acknowledge the <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}

export function Brand() {
  return (
    <div className="brand" aria-label="Momentum">
      <span className="brand-mark" aria-hidden="true"><TrendingUp size={19} /></span>
      <span>Momentum</span>
    </div>
  );
}


