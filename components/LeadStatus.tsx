"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LeadStatus({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function update(value: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: value }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not update status");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update status");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <select
        className="field"
        aria-label="Lead status"
        value={status}
        disabled={pending || status === "booked"}
        onChange={(e) => void update(e.target.value)}
      >
        {["new", "contacted", "booked", "won", "lost"].map((value) => (
          <option key={value} disabled={value === "booked"}>
            {value}
          </option>
        ))}
      </select>
      {error && (
        <small className="error-message" role="alert">
          {error}
        </small>
      )}
    </>
  );
}
