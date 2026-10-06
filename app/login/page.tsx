"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        <h1>Sign in</h1>
        {sent ? (
          <p>Check your email for the magic link.</p>
        ) : (
          <>
            <input
              className="field"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@business.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && email.trim() && !pending) void login();
              }}
            />
            {error && <p className="error-message">{error}</p>}
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
      </div>
    </main>
  );
}
