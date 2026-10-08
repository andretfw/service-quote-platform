import Link from "next/link";
import AppShell from "@/components/AppShell";
import BookingCalendar from "@/components/BookingCalendar";
import CalendarSettings from "@/components/CalendarSettings";
import { Text } from "@/components/Language";
import { pageWorkspace } from "@/lib/server/page-workspace";
import { scheduleSettings } from "@/lib/server/calendar";
import { calendarConfig } from "@/lib/server/calendar-provider";
import { dateInZone, type CalendarBooking } from "@/lib/calendar";
export const dynamic = "force-dynamic";
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; calendar?: string }>;
}) {
  const workspace = await pageWorkspace();
  const params = await searchParams;
  if (workspace.plan !== "business")
    return (
      <AppShell>
        <main className="shell app-page">
          <h1>
            <Text>Booking calendar</Text>
          </h1>
          <p>
            <Text>Available on Business.</Text>
          </p>
          <Link className="btn" href="/billing">
            <Text>Compare plans</Text>
          </Link>
        </main>
      </AppShell>
    );
  const settings = await scheduleSettings(workspace.organizationId);
  const month = /^(20[2-9]\d)-(0[1-9]|1[0-2])$/.test(params.month ?? "")
    ? params.month!
    : dateInZone(new Date(), settings.timezone).slice(0, 7);
  const [year, number] = month.split("-").map(Number);
  const from = new Date(Date.UTC(year, number - 1, -7)).toISOString(),
    until = new Date(Date.UTC(year, number, 9)).toISOString();
  const [bookings, blocks, connections] = await Promise.all([
    workspace.db.rpc("workspace_calendar", {
      p_org: workspace.organizationId,
      p_from: from,
      p_until: until,
    }),
    workspace.db
      .from("calendar_blocks")
      .select("*")
      .eq("organization_id", workspace.organizationId)
      .lt("starts_at", until)
      .gt("ends_at", from)
      .order("starts_at")
      .limit(1000),
    workspace.db
      .from("calendar_connections")
      .select("provider")
      .eq("organization_id", workspace.organizationId),
  ]);
  if (bookings.error || blocks.error || connections.error)
    throw new Error("Unable to load booking calendar");
  const statuses = await Promise.all(
    connections.data.map(async (c) => {
      const [failed, pending] = await Promise.all(
        ["failed", "pending"].map((status) =>
          workspace.db
            .from("calendar_deliveries")
            .select("booking_id", { count: "exact", head: true })
            .eq("organization_id", workspace.organizationId)
            .eq("provider", c.provider)
            .eq("status", status),
        ),
      );
      if (failed.error || pending.error) throw new Error("Unable to load calendar sync status");
      return { provider: c.provider, failed: failed.count ?? 0, pending: pending.count ?? 0 };
    }),
  );
  const configured = { google: false, outlook: false };
  for (const provider of ["google", "outlook"] as const) {
    try {
      calendarConfig(provider);
      configured[provider] = true;
    } catch {
      configured[provider] = false;
    }
  }
  return (
    <AppShell>
      <main className="shell app-page">
        <h1>
          <Text>Booking calendar</Text>
        </h1>
        <p>
          <Text>Manage your schedule here, with or without an external calendar.</Text>
        </p>
        <Link className="text-link" href="/bookings">
          <Text>Booking history</Text> →
        </Link>
        {params.calendar && (
          <p role="status" className="notice">
            <Text>
              {params.calendar === "connected"
                ? "Calendar connected. Confirmed bookings are queued for synchronization."
                : "Calendar connection failed. Try again and grant calendar access."}
            </Text>
          </p>
        )}
        {blocks.data.length === 1000 && (
          <p className="notice">
            <Text>
              Too many blocked periods to display completely. Narrow your schedule before adding
              more.
            </Text>
          </p>
        )}
        <BookingCalendar
          month={month}
          timezone={settings.timezone}
          bookings={bookings.data as unknown as CalendarBooking[]}
          blocks={blocks.data}
        />
        <CalendarSettings
          settings={settings}
          connections={statuses}
          blocks={blocks.data}
          owner={workspace.role === "owner"}
          configured={configured}
        />
      </main>
    </AppShell>
  );
}
