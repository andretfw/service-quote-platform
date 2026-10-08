export type CalendarProvider = "google" | "outlook";
export type ScheduleSettings = {
  organization_id: string;
  timezone: string;
  duration_minutes: number;
  weekdays: number[];
  opens_at: string;
  closes_at: string;
  enforce_hours: boolean;
};
export type CalendarBooking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  name: string;
};
export const defaultSchedule = (organizationId: string): ScheduleSettings => ({
  organization_id: organizationId,
  timezone: "UTC",
  duration_minutes: 60,
  weekdays: [1, 2, 3, 4, 5],
  opens_at: "09:00",
  closes_at: "17:00",
  enforce_hours: false,
});
export function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
export function dateInZone(value: string | Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function overlaps(start: string, end: string, busy: { start: string; end: string }[]) {
  return busy.some(
    (item) => Date.parse(start) < Date.parse(item.end) && Date.parse(end) > Date.parse(item.start),
  );
}
// Resolve date-only provider events in the calendar's own IANA time zone.
export function calendarMidnight(date: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !validTimezone(timezone))
    throw new Error("Invalid calendar date or time zone");
  const target = Date.parse(`${date}T00:00:00Z`);
  let instant = target;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 4; i++) {
    const parts = formatter.formatToParts(new Date(instant));
    const get = (key: string) => parts.find((p) => p.type === key)!.value;
    const local = Date.parse(
      `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`,
    );
    const correction = target - local;
    if (!correction) return new Date(instant).toISOString();
    instant += correction;
  }
  // A skipped midnight must not silently permit an overlapping all-day event.
  throw new Error("Calendar midnight cannot be resolved");
}
