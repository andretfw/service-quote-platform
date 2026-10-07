"use client";
import { Text } from "@/components/Language";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BookingStatus({ id, status }: { id: string; status: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function update(value: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: value }),
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
      {error && (
        <p className="error-message" role="alert">
          <Text>{error}</Text>
        </p>
      )}
    </div>
  );
}
