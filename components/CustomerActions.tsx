"use client";
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
          <h3>Request a preferred time</h3>
          <label>
            Your local date and time
            <input
              className="field"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>
          <p className="muted">
            This is a request, subject to the business availability. You can leave this blank and
            let the business contact you.
          </p>
          <button className="btn" disabled={pending || !startsAt} onClick={() => void act("book")}>
            Request booking
          </button>
        </>
      )}
      {deposits && (
        <>
          <h3>Pay a service deposit</h3>
          <p className="muted">
            Review the deposit amount on Stripe before paying. A deposit does not confirm a booking.
          </p>
          <button className="btn" disabled={pending} onClick={() => void act("create-checkout")}>
            Review deposit
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
