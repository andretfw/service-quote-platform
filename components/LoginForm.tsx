"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginForm({ initialError }: { initialError: string | null }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);

  const login = async () => {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not send sign-in link");
      setSent(true);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Could not send sign-in link");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="shell">
      <div className="quote card">
        <h1>Sign in or create your business account</h1>
        <p>Use your business email. We will send you a secure sign-in link; no password needed.</p>
        {sent ? (
          <p role="status">
            Check your inbox and spam folder. Open the sign-in link in this browser to continue.
          </p>
        ) : (
          <>
            <label htmlFor="business-email">Business email</label>
            <input
              id="business-email"
              className="field"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="you@business.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && email.trim() && !pending) void login();
              }}
            />
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
            <div className="action-row">
              <button
                className="btn"
                disabled={pending || !email.trim()}
                onClick={() => void login()}
              >
                {pending ? "Sending…" : "Email me a sign-in link"}
              </button>
            </div>
          </>
        )}
        <p>
          <Link href="/calculators">Explore the calculator demos</Link>
        </p>
      </div>
    </main>
  );
}
