import Link from "next/link";
import { pageWorkspace } from "@/lib/server/page-workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BookingStatus from "@/components/BookingStatus";

export const dynamic = "force-dynamic";
export default async function BookingsPage() {
  await pageWorkspace();
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("bookings")
    .select("id,submission_id,starts_at,status")
    .order("starts_at")
    .limit(250);
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
    <main className="shell">
      <nav className="nav">
        <Link className="brand" href="/dashboard">
          ← Dashboard
        </Link>
      </nav>
      <h1>Booking requests</h1>
      <p className="muted">
        Times below are shown in UTC. Confirm availability with the customer before accepting.
      </p>
      {data.map((booking) => {
        const lead = leads?.find((l) => l.id === booking.submission_id);
        return (
          <div className="card" key={booking.id}>
            <h2>{lead?.lead_name ?? "Customer"}</h2>
            <p>{new Date(booking.starts_at).toISOString().replace("T", " ").slice(0, 16)} UTC</p>
            <p>{lead?.lead_email ?? lead?.lead_phone}</p>
            <BookingStatus id={booking.id} status={booking.status} />
          </div>
        );
      })}
      {!data.length && <p>No booking requests yet.</p>}
    </main>
  );
}
