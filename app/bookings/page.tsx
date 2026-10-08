import Link from "next/link";
import { scheduleSettings } from "@/lib/server/calendar";
import { uiLocale } from "@/lib/server/locale";
import { translate } from "@/lib/i18n";
import ResultsPagination from "@/components/ResultsPagination";
import { Text } from "@/components/Language";
import AppShell from "@/components/AppShell";
import { pageWorkspace } from "@/lib/server/page-workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BookingStatus from "@/components/BookingStatus";

export const dynamic = "force-dynamic";
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const params = await searchParams;
  const page = Math.min(10000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const pageSize = 50;
  const status = ["requested", "confirmed", "cancelled", "completed"].includes(params.status ?? "")
    ? params.status!
    : "";
  const locale = await uiLocale();
  const t = (source: string) => translate(source, locale);
  const workspace = await pageWorkspace();
  const settings = await scheduleSettings(workspace.organizationId);
  const db = await createSupabaseServerClient();
  let query = db
    .from("bookings")
    .select("id,submission_id,starts_at,ends_at,status", { count: "exact" })
    .order("starts_at")
    .order("id");
  if (status) query = query.eq("status", status);
  const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error("Unable to load bookings");
  const { data: leads, error: leadError } = await db
    .from("submissions")
    .select("id,lead_name,lead_email,lead_phone")
    .in(
      "id",
      data.map((b) => b.submission_id),
    );
  if (leadError) throw new Error("Unable to load booking contacts");
  return (
    <AppShell>
      <main className="shell app-page">
        <h1>
          <Text>{"Booking requests"}</Text>
        </h1>
        <p className="muted">
          <Text>
            {
              "Times use the business time zone. Confirm availability with the customer before accepting."
            }
          </Text>
        </p>
        <p>
          {settings.timezone} ·{" "}
          <Link className="text-link" href="/calendar">
            <Text>Open booking calendar</Text>
          </Link>
        </p>
        <form className="lead-filters" action="/bookings" method="get">
          <label>
            <Text>Status</Text>
            <select className="field" name="status" defaultValue={status}>
              <option value="">{t("All statuses")}</option>
              {["requested", "confirmed", "cancelled", "completed"].map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" type="submit">
            <Text>Filter bookings</Text>
          </button>
        </form>
        {data.map((booking) => {
          const lead = leads?.find((l) => l.id === booking.submission_id);
          return (
            <div className="card" key={booking.id}>
              <h2>{lead?.lead_name ?? "Customer"}</h2>
              <p>
                {new Intl.DateTimeFormat(locale, {
                  timeZone: settings.timezone,
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(booking.starts_at))}{" "}
                {settings.timezone}
              </p>
              <p>{lead?.lead_email ?? lead?.lead_phone}</p>
              <BookingStatus
                id={booking.id}
                status={booking.status}
                startsAt={booking.starts_at}
                endsAt={booking.ends_at}
              />
            </div>
          );
        })}
        <ResultsPagination
          page={page}
          total={count ?? 0}
          pageSize={pageSize}
          path="/bookings"
          filters={{ status }}
          label="{count} bookings · Page {page} of {pages}"
        />
        {!data.length && (
          <p>
            <Text>{status ? "No matching bookings." : "No booking requests yet."}</Text>
          </p>
        )}
      </main>
    </AppShell>
  );
}
