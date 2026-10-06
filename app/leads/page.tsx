import Link from "next/link";
import { redirect } from "next/navigation";
import { publicSupabaseConfigured } from "@/lib/server/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  if (!publicSupabaseConfigured()) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data, error } = await supabase
    .from("submissions")
    .select("id,lead_name,lead_email,lead_phone,template_slug,status,follow_up_count,created_at")
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
              <th>Status</th>
              <th>Follow-ups</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>{lead.lead_name}</td>
                <td>{lead.lead_email || lead.lead_phone || "—"}</td>
                <td>{lead.template_slug || "Custom"}</td>
                <td>
                  <span className="pill">{lead.status}</span>
                </td>
                <td>{lead.follow_up_count}</td>
              </tr>
            ))}
            {!leads.length && (
              <tr>
                <td colSpan={5} className="muted">
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
