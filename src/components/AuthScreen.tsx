"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Check, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
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

    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setError(result.error.message);
    } else if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your account, then sign in.");
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

