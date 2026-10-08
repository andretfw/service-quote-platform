"use client";
import { useState } from "react";
import Link from "next/link";
import { dateInZone, type CalendarBooking } from "@/lib/calendar";
import { useLanguage } from "./Language";
import BookingStatus from "./BookingStatus";
export default function BookingCalendar({
  month,
  timezone,
  bookings,
  blocks,
}: {
  month: string;
  timezone: string;
  bookings: CalendarBooking[];
  blocks: { id: string; starts_at: string; ends_at: string; label: string }[];
}) {
  const { t, locale } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const date = (value: Date) => value.toISOString().slice(0, 10);
  const time = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  const dayItems = (key: string) =>
    bookings.filter(
      (b) =>
        dateInZone(b.starts_at, timezone) <= key &&
        dateInZone(new Date(Date.parse(b.ends_at) - 1), timezone) >= key,
    );
  const dayBlocks = (key: string) =>
    blocks.filter(
      (b) =>
        dateInZone(b.starts_at, timezone) <= key &&
        dateInZone(new Date(Date.parse(b.ends_at) - 1), timezone) >= key,
    );
  const prev = new Date(Date.UTC(year, number - 2, 1)).toISOString().slice(0, 7),
    next = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 7);
  return (
    <section className="card">
      <div className="calendar-heading">
        <Link className="btn secondary" href={`/calendar?month=${prev}`}>
          {t("Previous month")}
        </Link>
        <h2>
          {new Intl.DateTimeFormat(locale, {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(first)}
        </h2>
        <Link className="btn secondary" href={`/calendar?month=${next}`}>
          {t("Next month")}
        </Link>
      </div>
      <p className="muted">
        {t("Business time zone")}: {timezone}
      </p>
      <div className="calendar-grid" role="group" aria-label={t("Booking calendar")}>
        {Array.from({ length: 7 }, (_, i) => (
          <div className="calendar-weekday" key={i}>
            {new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
              new Date(Date.UTC(2026, 0, 5 + i)),
            )}
          </div>
        ))}
        {Array.from({ length: 42 }, (_, i) => {
          const day = new Date(start);
          day.setUTCDate(day.getUTCDate() + i);
          const key = date(day);
          const items = dayItems(key).filter((b) => b.status !== "cancelled"),
            unavailable = dayBlocks(key);
          return (
            <button
              key={key}
              className={`calendar-day ${key.slice(0, 7) !== month ? "outside" : ""} ${selected === key ? "selected" : ""}`}
              aria-pressed={selected === key}
              aria-label={`${key}, ${items.length} ${t(items.length === 1 ? "booking" : "bookings")}${unavailable.length ? `, ${t("Unavailable")}` : ""}`}
              onClick={() => setSelected(key)}
            >
              <strong>{day.getUTCDate()}</strong>
              {items.length > 0 && (
                <span>
                  {items.length}{" "}
                  <span className="calendar-count-label">
                    {t(items.length === 1 ? "booking" : "bookings")}
                  </span>
                </span>
              )}
              {unavailable.length > 0 && (
                <span className="calendar-block-dot" aria-hidden="true">
                  <span className="calendar-block-label">{t("Unavailable")}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="calendar-agenda">
          <h3>{selected}</h3>
          {!dayItems(selected).length && !dayBlocks(selected).length && (
            <p>{t("No bookings or blocked time.")}</p>
          )}
          {dayBlocks(selected).map((block) => (
            <div className="notice" key={block.id}>
              {block.label} · {time(block.starts_at)}–{time(block.ends_at)}
            </div>
          ))}
          {dayItems(selected).map((booking) => (
            <article className="card" key={booking.id}>
              <h3>{booking.name}</h3>
              <p>
                {time(booking.starts_at)}–{time(booking.ends_at)}
              </p>
              <BookingStatus
                id={booking.id}
                status={booking.status}
                startsAt={booking.starts_at}
                endsAt={booking.ends_at}
              />
            </article>
          ))}
        </div>
      )}
      <p className="small muted">
        {t("Requests need confirmation. Only confirmed bookings reserve time.")}
      </p>
    </section>
  );
}
