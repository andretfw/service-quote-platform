"use client";
import { Text } from "@/components/Language";

import { useState } from "react";

export default function Unsubscribe({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function unsubscribe() {
    setPending(true);
    try {
      const response = await fetch(`/api/public/unsubscribe?token=${encodeURIComponent(token)}`, {
        method: "POST",
      });
      const data = (await response.json()) as { error?: string };
      setMessage(
        response.ok
          ? "Optional estimate reminders have been stopped."
          : (data.error ?? "Could not update preferences"),
      );
    } catch {
      setMessage("Could not update preferences. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="card">
      <h1>
        <Text>{"Email preferences"}</Text>
      </h1>
      <p>
        <Text>{"Stop optional follow-up emails for this estimate request."}</Text>
      </p>
      <button className="btn" disabled={pending} onClick={() => void unsubscribe()}>
        <Text>{"Unsubscribe"}</Text>
      </button>
      {message && (
        <p role="status">
          <Text>{message}</Text>
        </p>
      )}
    </div>
  );
}
