"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "./Language";
import type { ScheduleSettings, CalendarProvider } from "@/lib/calendar";
export default function CalendarSettings({
  settings,
  connections,
  blocks,
  owner,
  configured,
}: {
  settings: ScheduleSettings;
  connections: { provider: string; failed: number; pending: number }[];
  blocks: { id: string; label: string; starts_at: string; ends_at: string }[];
  owner: boolean;
  configured: Record<CalendarProvider, boolean>;
}) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [form, setForm] = useState({
    ...settings,
    opens_at: settings.opens_at.slice(0, 5),
    closes_at: settings.closes_at.slice(0, 5),
  });
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [block, setBlock] = useState({ startsAt: "", endsAt: "", label: "" });
  async function act(url: string, method: string, body?: unknown) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Request failed");
      if (result.url) window.location.assign(result.url);
      else {
        setMessage("Changes saved.");
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed");
    } finally {
      setPending(false);
    }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    const { organization_id: _organization, ...values } = form;
    void _organization;
    void act("/api/calendar/settings", "PUT", values);
  }
  return (
    <div className="calendar-settings">
      <section className="card">
        <h2>{t("Availability settings")}</h2>
        <p>{t("Use the internal calendar without connecting another account.")}</p>
        <form onSubmit={save}>
          <label>
            {t("Business time zone")}
            <input
              className="field"
              required
              value={form.timezone}
              placeholder="Europe/Bucharest"
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              disabled={!owner || pending}
            />
          </label>
          <label>
            {t("Default service duration (minutes)")}
            <input
              className="field"
              type="number"
              min={15}
              max={1440}
              required
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
              disabled={!owner || pending}
            />
          </label>
          <fieldset disabled={!owner || pending}>
            <legend>{t("Working days")}</legend>
            <div className="action-row">
              {Array.from({ length: 7 }, (_, day) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    checked={form.weekdays.includes(day)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        weekdays: e.target.checked
                          ? [...form.weekdays, day]
                          : form.weekdays.filter((v) => v !== day),
                      })
                    }
                  />
                  {new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
                    new Date(Date.UTC(2026, 0, 4 + day)),
                  )}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            {t("Opening time")}
            <input
              className="field"
              type="time"
              required
              value={form.opens_at}
              onChange={(e) => setForm({ ...form, opens_at: e.target.value })}
              disabled={!owner || pending}
            />
          </label>
          <label>
            {t("Closing time")}
            <input
              className="field"
              type="time"
              required
              value={form.closes_at}
              onChange={(e) => setForm({ ...form, closes_at: e.target.value })}
              disabled={!owner || pending}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={form.enforce_hours}
              onChange={(e) => setForm({ ...form, enforce_hours: e.target.checked })}
              disabled={!owner || pending}
            />
            {t("Accept requests only within working hours")}
          </label>
          <button className="btn" disabled={!owner || pending}>
            {t("Save availability")}
          </button>
        </form>
      </section>
      <section className="card">
        <h2>{t("Block unavailable time")}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act("/api/calendar/blocks", "POST", {
              ...block,
              startsAt: new Date(block.startsAt).toISOString(),
              endsAt: new Date(block.endsAt).toISOString(),
            });
          }}
        >
          <p className="small muted">
            {t(
              "Enter dates in your device time zone. The calendar displays the business time zone.",
            )}
          </p>
          <label>
            {t("Start")}
            <input
              className="field"
              type="datetime-local"
              required
              value={block.startsAt}
              onChange={(e) => setBlock({ ...block, startsAt: e.target.value })}
              disabled={!owner || pending}
            />
          </label>
          <label>
            {t("End")}
            <input
              className="field"
              type="datetime-local"
              required
              value={block.endsAt}
              onChange={(e) => setBlock({ ...block, endsAt: e.target.value })}
              disabled={!owner || pending}
            />
          </label>
          <label>
            {t("Label")}
            <input
              className="field"
              required
              maxLength={160}
              value={block.label}
              onChange={(e) => setBlock({ ...block, label: e.target.value })}
              disabled={!owner || pending}
            />
          </label>
          <button className="btn" disabled={!owner || pending}>
            {t("Block time")}
          </button>
        </form>
        {blocks.map((b) => (
          <div className="calendar-block-row" key={b.id}>
            <span>
              {b.label} ·{" "}
              {new Intl.DateTimeFormat(locale, {
                timeZone: settings.timezone,
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(b.starts_at))}
            </span>
            <button
              className="btn secondary"
              disabled={!owner || pending}
              onClick={() => void act("/api/calendar/blocks", "DELETE", { id: b.id })}
            >
              {t("Remove")}
            </button>
          </div>
        ))}
      </section>
      <section className="card">
        <h2>{t("Connected calendars")}</h2>
        <p>
          {t(
            "Confirmed bookings are added to your primary calendar. Changes and cancellations are sent automatically. External busy times are checked before a request or confirmation.",
          )}
        </p>
        <p className="small muted">
          {t(
            "Edit bookings here. Edits made in Google or Outlook do not change the booking in this dashboard.",
          )}
        </p>
        {(["google", "outlook"] as const).map((provider) => {
          const connection = connections.find((c) => c.provider === provider);
          return (
            <div className="calendar-provider" key={provider}>
              <h3>{provider === "google" ? "Google Calendar" : "Outlook Calendar"}</h3>
              {!configured[provider] && (
                <p className="notice">{t("Calendar connection is awaiting platform setup.")}</p>
              )}
              {connection && (
                <p>
                  {t("Connected")} · {connection.pending} {t("Pending")} · {connection.failed}{" "}
                  {t("Failed")}
                </p>
              )}
              <div className="action-row">
                <button
                  className="btn"
                  disabled={!owner || pending || !configured[provider]}
                  onClick={() => void act(`/api/calendar/${provider}/connect`, "POST")}
                >
                  {t(connection ? "Reconnect" : "Connect")}
                </button>
                {connection && (
                  <>
                    <button
                      className="btn secondary"
                      disabled={!owner || pending}
                      onClick={() => void act(`/api/calendar/${provider}`, "POST")}
                    >
                      {t("Retry failed sync")}
                    </button>
                    <button
                      className="btn secondary"
                      disabled={!owner || pending}
                      onClick={() => void act(`/api/calendar/${provider}`, "DELETE")}
                    >
                      {t("Disconnect")}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <p className="small muted">
          {t(
            "Disconnecting stops synchronization. Existing events remain in the external calendar.",
          )}
        </p>
      </section>
      {error && (
        <p role="alert" className="error-message">
          {t(error)}
        </p>
      )}
      {message && <p role="status">{t(message)}</p>}
    </div>
  );
}
