"use client";

import { FormEvent, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowRight, Check, TrendingUp } from "lucide-react";
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

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
        email,
        password,
        options: { data: { username: normalizedUsername } },
      });
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });
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
    setBusy(false);
  }

  function changeMode(nextMode: "signin" | "signup") {
    setMode(nextMode);
    setError("");
    setMessage("");
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
              <div><span>Privacy</span><strong>Your records stay yours</strong></div>
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
              : "Your training records are private to your account."}
          </p>

          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={mode === "signin" ? "active" : ""}
              onClick={() => changeMode("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={mode === "signup" ? "active" : ""}
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

            <button className="primary-button auth-submit" disabled={busy}>
              {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </form>

          <p className="privacy-note">
            Secured with Supabase authentication and private row-level access.
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


