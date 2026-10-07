import { emailAlertsConfigured } from "@/lib/server/notifications";
import { formatEstimate } from "@/lib/lead-summary";
import LeadStatus from "@/components/LeadStatus";
import Link from "next/link";
import { pageWorkspace } from "@/lib/server/page-workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const workspace = await pageWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data: calculators, error: calculatorError } = await workspace.db
    .from("calculators")
    .select("id")
    .eq("organization_id", workspace.organizationId);
  if (calculatorError) throw new Error("Unable to load business calculators");

  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id,lead_name,lead_email,lead_phone,template_slug,status,follow_up_count,created_at,quote",
    )
    .in(
      "calculator_id",
      calculators.map((calculator) => calculator.id),
    )
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) throw new Error("Unable to load lead pipeline");
  const leads = data ?? [];

  return (
    <main className="shell">
      <div className="nav">
        <Link className="brand" href="/dashboard">
          ← Dashboard
        </Link>
      </div>
      <h1>Lead pipeline</h1>
      {!emailAlertsConfigured() && (
        <p className="notice">
          Email alerts are not configured yet. Enquiries are saved here; open a lead to review the
          full request.
        </p>
      )}
      <div className="row">
        <Link href="/api/leads/export">Export CSV (Premium / Business)</Link>
        <Link href="/bookings">Booking requests</Link>
      </div>
      <p className="muted">
        Follow-ups stop automatically when a lead reaches booked, won or lost.
      </p>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Contact</th>
              <th>Template</th>
              <th>Estimate</th>
              <th>Status</th>
              <th>Follow-ups</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <Link href={`/leads/${lead.id}`}>{lead.lead_name}</Link>
                </td>
                <td>{lead.lead_email || lead.lead_phone || "—"}</td>
                <td>{lead.template_slug || "Custom"}</td>
                <td>{formatEstimate(lead.quote)}</td>
                <td>
                  <LeadStatus id={lead.id} status={lead.status} />
                </td>
                <td>{lead.follow_up_count}</td>
              </tr>
            ))}
            {!leads.length && (
              <tr>
                <td colSpan={6} className="muted">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
