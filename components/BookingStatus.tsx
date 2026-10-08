"use client";
import { Text } from "@/components/Language";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BookingStatus({
  id,
  status,
  startsAt,
  endsAt,
}: {
  id: string;
  status: string;
  startsAt?: string;
  endsAt?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState(
    startsAt && endsAt ? Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60000) : 60,
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function update(value: string | { startsAt: string; endsAt: string }) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(typeof value === "string" ? { status: value } : value),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not update booking");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update booking");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <span className="status-badge">
        <Text>{status}</Text>
      </span>
      {status === "requested" && (
        <button className="btn" disabled={pending} onClick={() => void update("confirmed")}>
          <Text>{"Confirm"}</Text>
        </button>
      )}
      {status === "confirmed" && (
        <button className="btn" disabled={pending} onClick={() => void update("completed")}>
          <Text>{"Mark completed"}</Text>
        </button>
      )}
      {["requested", "confirmed"].includes(status) && (
        <button
          className="btn secondary"
          disabled={pending}
          onClick={() => void update("cancelled")}
        >
          <Text>{"Cancel"}</Text>
        </button>
      )}
      {startsAt && ["requested", "confirmed"].includes(status) && (
        <button className="btn secondary" disabled={pending} onClick={() => setEditing(!editing)}>
          <Text>Reschedule</Text>
        </button>
      )}
      {editing && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const start = new Date(date);
            void update({
              startsAt: start.toISOString(),
              endsAt: new Date(start.getTime() + duration * 60000).toISOString(),
            });
          }}
        >
          <p className="small muted">
            <Text>
              Enter dates in your device time zone. The calendar displays the business time zone.
            </Text>
          </p>
          <label>
            <Text>New start time</Text>
            <input
              className="field"
              type="datetime-local"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            <Text>Duration (minutes)</Text>
            <input
              className="field"
              type="number"
              min={15}
              max={1440}
              required
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </label>
          <button className="btn" disabled={pending}>
            <Text>Save new time</Text>
          </button>
        </form>
      )}
      {error && (
        <p className="error-message" role="alert">
          <Text>{error}</Text>
        </p>
      )}
    </div>
  );
}
