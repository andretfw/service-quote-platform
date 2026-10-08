"use client";
import { Text, LocalizedInput } from "@/components/Language";

import { useState } from "react";

export default function CustomerActions({
  submissionId,
  accessToken,
  bookings,
  deposits,
}: {
  submissionId: string;
  accessToken: string;
  bookings?: boolean;
  deposits?: boolean;
}) {
  const [startsAt, setStartsAt] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);
  async function act(action: "book" | "create-checkout") {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/public/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          submissionId,
          accessToken,
          ...(action === "book" ? { startsAt: new Date(startsAt).toISOString() } : {}),
        }),
      });
      const data = (await response.json()) as { error?: string; url?: string };
      if (!response.ok) throw new Error(data.error ?? "Request failed");
      if (data.url) window.location.assign(data.url);
      if (action === "book") {
        setRequested(true);
        setMessage(
          "Preferred time sent. Your booking is confirmed only when the business accepts it.",
        );
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Request failed");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="customer-actions">
      {bookings && !requested && (
        <>
          <h3>
            <Text>{"Request a preferred time"}</Text>
          </h3>
          <label>
            <Text>{"Your local date and time"}</Text>
            <LocalizedInput
              className="field"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>
          <p className="muted">
            <Text>
              {
                "This is a request, subject to the business availability. You can leave this blank and let the business contact you."
              }
            </Text>
          </p>
          <button className="btn" disabled={pending || !startsAt} onClick={() => void act("book")}>
            <Text>{"Request booking"}</Text>
          </button>
        </>
      )}
      {deposits && (
        <>
          <h3>
            <Text>{"Pay a service deposit"}</Text>
          </h3>
          <p className="muted">
            <Text>
              {
                "Review the deposit amount on Stripe before paying. A deposit does not confirm a booking."
              }
            </Text>
          </p>
          <button className="btn" disabled={pending} onClick={() => void act("create-checkout")}>
            <Text>{"Review deposit"}</Text>
          </button>
        </>
      )}
      {message && (
        <p role="status">
          <Text>{message}</Text>
        </p>
      )}
      {error && (
        <p className="error-message" role="alert">
          <Text>{error}</Text>
        </p>
      )}
    </div>
  );
}
