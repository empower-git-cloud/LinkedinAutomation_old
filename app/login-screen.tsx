"use client";

import { FormEvent, useState } from "react";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Sign in failed.");
      window.location.href = "/";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed.");
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand"><span className="brand-mark"><i /><i /><i /></span><b>SignalLayer</b></div>
        <h1>Sign in to your workspace</h1>
        <p>Enter your email to open your private workspace. Your business or profile details, drafts, and analytics are stored against this email.</p>
        <form onSubmit={submit}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
          {error && <p className="login-error">{error}</p>}
          <button className="primary-button full" type="submit" disabled={busy}>{busy ? "Signing in…" : "Continue"}</button>
        </form>
        <p className="login-note">New here? Entering your email creates a fresh, empty workspace and walks you through setup.</p>
      </div>
    </div>
  );
}
