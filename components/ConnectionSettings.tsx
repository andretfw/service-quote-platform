"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "./Language";
export type Connection = { endpoint_url: string; enabled: boolean; provider: string } | null;
export default function ConnectionSettings({
  connection,
  allowed,
  owner,
}: {
  connection: Connection;
  allowed: boolean;
  owner: boolean;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [url, setUrl] = useState(connection?.endpoint_url ?? "");
  const [enabled, setEnabled] = useState(connection?.enabled ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savedUrl, setSavedUrl] = useState(connection?.endpoint_url ?? "");
  async function act(test = false, pause = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(test ? "/api/integrations/test" : "/api/integrations", {
        method: test ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: test
          ? undefined
          : JSON.stringify({ url: pause ? savedUrl : url, enabled: pause ? false : enabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Request could not be completed");
      if (!test) {
        setSavedUrl(pause ? savedUrl : url);
        if (pause) setEnabled(false);
      }
      setMessage(
        test
          ? "Sample sent. Check your automation tool to map the fields."
          : "Connection saved. Changes apply to new enquiries.",
      );
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request could not be completed");
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void act();
  }
  return (
    <div className="card connection-form">
      <span className="eyebrow">{t("New enquiry automation")}</span>
      <h2>{t("Connect Zapier or Make")}</h2>
      <p className="muted">
        {t(
          "Send new enquiries, contact details, answers and estimates to one automation workflow. Delivery normally starts within five minutes.",
        )}
      </p>
      {!allowed && (
        <p className="notice">
          {t("Available on Premium and Business.")}{" "}
          <Link className="text-link" href="/billing">
            {t("Compare plans")} →
          </Link>
        </p>
      )}
      {!owner && <p className="notice">{t("Only the workspace owner can manage connections")}</p>}
      <form onSubmit={submit}>
        <label>
          {t("Webhook URL")}
          <input
            className="field"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={512}
            required
            autoComplete="off"
            disabled={!allowed || !owner || busy}
            placeholder="https://hooks.zapier.com/hooks/catch/…"
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={!allowed || !owner || busy}
          />
          {t("Send new enquiries automatically")}
        </label>
        <p className="small muted">
          {t(
            "The URL can grant access to your automation. Keep it private. Saving changes cancels pending deliveries for the previous connection.",
          )}
        </p>
        <div className="action-row">
          <button className="btn" type="submit" disabled={!allowed || !owner || busy}>
            {t(busy ? "Working…" : "Save connection")}
          </button>
          <button
            className="btn secondary"
            type="button"
            disabled={!allowed || !owner || busy || !savedUrl || url !== savedUrl}
            onClick={() => void act(true)}
          >
            {t("Send sample")}
          </button>
          {savedUrl && (
            <button
              className="btn secondary"
              type="button"
              disabled={!owner || busy}
              onClick={() => void act(false, true)}
            >
              {t("Pause connection")}
            </button>
          )}
        </div>
      </form>
      {error && (
        <p className="error-message" role="alert">
          {t(error)}
        </p>
      )}
      <p aria-live="polite">{t(message)}</p>
    </div>
  );
}
