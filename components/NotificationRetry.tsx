"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NotificationRetry({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function retry() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/leads/${id}/notify`, { method: "POST" });
      const data = (await response.json()) as { sent?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not retry email delivery.");
      setMessage(
        data.sent
          ? "Email accepted for sending."
          : "Email remains queued. Check the sending configuration and try again later.",
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not retry email delivery.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className="btn secondary"
        disabled={pending}
        onClick={() => void retry()}
      >
        {pending ? "Sending…" : "Retry email alert"}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
