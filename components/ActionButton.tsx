"use client";
import { useState } from "react";

export default function ActionButton({
  endpoint,
  body,
  children,
  disabled = false,
}: {
  endpoint: string;
  body?: object;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function act() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not complete request");
      if (data.url) window.location.assign(data.url);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not complete request");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <button className="btn" disabled={disabled || pending} onClick={() => void act()}>
        {pending ? "Opening…" : children}
      </button>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
