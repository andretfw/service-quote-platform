import "server-only";
import { defaultSchedule, overlaps, type CalendarProvider } from "@/lib/calendar";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlement } from "./workspace";
import { HttpError, publicApiError } from "./http";
import { providerBusy, writeCalendarBooking, calendarProvider } from "./calendar-provider";
import type { Database } from "@/lib/supabase/database.types";
import { calendarEventId } from "./calendar-security";
export function calendarApiError(error: unknown) {
  const safeConflicts = [
    "This time is unavailable",
    "Outside business working hours",
    "This block overlaps a confirmed booking",
  ];
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P0001" &&
    "message" in error &&
    safeConflicts.includes(String(error.message))
  )
    return { status: 409, message: String(error.message) };
  return publicApiError(error);
}
export async function scheduleSettings(organizationId: string) {
  const { data, error } = await createAdminClient()
    .from("booking_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  return data ?? defaultSchedule(organizationId);
}
export async function assertExternalAvailability(
  organizationId: string,
  start: string,
  end: string,
  bookingId?: string,
) {
  const deadline = Date.now() + 20000;
  const db = createAdminClient();
  const { data, error } = await db
    .from("calendar_connections")
    .select("provider")
    .eq("organization_id", organizationId);
  if (error) throw error;
  for (const connection of data) {
    const provider = calendarProvider(connection.provider);
    let ignoreId: string | undefined;
    if (bookingId) {
      const event = await db
        .from("calendar_deliveries")
        .select("external_id")
        .eq("organization_id", organizationId)
        .eq("provider", provider)
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (event.error) throw event.error;
      ignoreId = event.data?.external_id ?? undefined;
      if (!ignoreId && provider === "google") ignoreId = calendarEventId(organizationId, bookingId);
    }
    if (
      overlaps(
        start,
        end,
        await providerBusy(organizationId, provider, start, end, ignoreId, bookingId, deadline),
      )
    )
      throw new HttpError(409, "This time is unavailable. Choose another time.");
  }
}
type Delivery = Database["public"]["Tables"]["calendar_deliveries"]["Row"];
export async function syncCalendars(deadline = Date.now() + 23000) {
  const db = createAdminClient();
  let synced = 0,
    failed = 0;
  for (let i = 0; i < 3 && Date.now() < deadline - 16000; i++) {
    const claim = await db.rpc("claim_calendar_deliveries", { p_limit: 1 });
    if (claim.error) throw claim.error;
    const item = (claim.data as unknown as Delivery[])[0];
    if (!item) break;
    const update = (values: Database["public"]["Tables"]["calendar_deliveries"]["Update"]) =>
      db
        .from("calendar_deliveries")
        .update(values)
        .eq("organization_id", item.organization_id)
        .eq("provider", item.provider)
        .eq("booking_id", item.booking_id)
        .eq("revision", item.revision)
        .eq("claim_token", item.claim_token!);
    try {
      const connection = await db
        .from("calendar_connections")
        .select("revision")
        .eq("organization_id", item.organization_id)
        .eq("provider", item.provider)
        .maybeSingle();
      if (connection.error) throw connection.error;
      const booking = await db
        .from("bookings")
        .select("id,starts_at,ends_at,status")
        .eq("id", item.booking_id)
        .single();
      if (booking.error) throw booking.error;
      if (
        !connection.data ||
        connection.data.revision !== item.connection_revision ||
        (booking.data.status !== "cancelled" &&
          (await getEntitlement(item.organization_id)).plan !== "business")
      ) {
        const result = await update({ status: "failed", claim_token: null });
        if (result.error) throw result.error;
        failed++;
        continue;
      }
      const id = await writeCalendarBooking(
        item.organization_id,
        calendarProvider(item.provider),
        booking.data,
        item.external_id,
        deadline - 1000,
        item.connection_revision,
      );
      const result = await update({ external_id: id, status: "synced", claim_token: null });
      if (result.error) throw result.error;
      synced++;
    } catch {
      const result = await update({
        status: item.attempts >= 5 ? "failed" : "pending",
        claim_token: null,
        next_attempt_at: new Date(
          Date.now() + Math.min(60, 2 ** item.attempts) * 60000,
        ).toISOString(),
      });
      if (result.error) throw result.error;
      failed++;
    }
  }
  return { synced, failed };
}
export async function retryCalendar(organizationId: string, provider: CalendarProvider) {
  const result = await createAdminClient()
    .from("calendar_deliveries")
    .update({
      status: "pending",
      attempts: 0,
      next_attempt_at: new Date().toISOString(),
      claim_token: null,
    })
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .eq("status", "failed");
  if (result.error) throw result.error;
}
