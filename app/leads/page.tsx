import { uiLocale } from "@/lib/server/locale";
import { getTemplate } from "@/lib/templates";
import { translate } from "@/lib/i18n";
import { Text } from "@/components/Language";
import ResultsPagination from "@/components/ResultsPagination";
import AppShell from "@/components/AppShell";
import { emailAlertsConfigured } from "@/lib/server/notifications";
import { formatEstimate } from "@/lib/lead-summary";
import LeadStatus from "@/components/LeadStatus";
import Link from "next/link";
import { pageWorkspace } from "@/lib/server/page-workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  const params = await searchParams;
  const page = Math.min(10000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const search = (params.search ?? "").trim().slice(0, 100);
  const status = ["new", "contacted", "booked", "won", "lost"].includes(params.status ?? "")
    ? params.status!
    : "";
  const pageSize = 50;
  const workspace = await pageWorkspace();
  const locale = await uiLocale();
  const t = (source: string) => translate(source, locale);
  const supabase = await createSupabaseServerClient();
  const { data: calculators, error: calculatorError } = await workspace.db
    .from("calculators")
    .select("id")
    .eq("organization_id", workspace.organizationId);
  if (calculatorError) throw new Error("Unable to load business calculators");

  let query = supabase
    .from("submissions")
    .select(
      "id,lead_name,lead_email,lead_phone,template_slug,status,follow_up_count,created_at,quote",
      { count: "exact" },
    )
    .in(
      "calculator_id",
      calculators.map((calculator) => calculator.id),
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (search) query = query.ilike("lead_name", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
  if (status) query = query.eq("status", status);
  const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);

  if (error) throw new Error("Unable to load lead pipeline");
  const leads = data ?? [];
  const total = count ?? 0;

  return (
    <AppShell>
      <main className="shell app-page">
        <h1>
          <Text>{"Lead pipeline"}</Text>
        </h1>
        {!emailAlertsConfigured() && (
          <p className="notice">
            <Text>
              {
                "Email alerts are not configured yet. Enquiries are saved here; open a lead to review the full request."
              }
            </Text>
          </p>
        )}
        <div className="row">
          <Link href="/api/leads/export">
            <Text>{"Export CSV (Premium / Business)"}</Text>
          </Link>
          <Link href="/bookings">
            <Text>{"Booking requests"}</Text>
          </Link>
        </div>
        <p className="muted">
          <Text>{"Follow-ups stop automatically when a lead reaches booked, won or lost."}</Text>
        </p>

        <form className="lead-filters" action="/leads" method="get">
          <label>
            <Text>Search customer names</Text>
            <input
              className="field"
              name="search"
              type="search"
              maxLength={100}
              defaultValue={search}
            />
          </label>
          <label>
            <Text>Status</Text>
            <select className="field" name="status" defaultValue={status}>
              <option value="">{t("All statuses")}</option>
              {["new", "contacted", "booked", "won", "lost"].map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" type="submit">
            <Text>Filter enquiries</Text>
          </button>
        </form>
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <Text>{"Lead"}</Text>
                  </th>
                  <th>
                    <Text>{"Contact"}</Text>
                  </th>
                  <th>
                    <Text>{"Template"}</Text>
                  </th>
                  <th>
                    <Text>{"Estimate"}</Text>
                  </th>
                  <th>
                    <Text>{"Status"}</Text>
                  </th>
                  <th>
                    <Text>{"Follow-ups"}</Text>
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <Link href={`/leads/${lead.id}`}>{lead.lead_name}</Link>
                    </td>
                    <td>{lead.lead_email || lead.lead_phone || "—"}</td>
                    <td>
                      <Text>{getTemplate(lead.template_slug)?.industry ?? "Custom"}</Text>
                    </td>
                    <td>{formatEstimate(lead.quote, locale)}</td>
                    <td>
                      <LeadStatus id={lead.id} status={lead.status} />
                    </td>
                    <td>{lead.follow_up_count}</td>
                  </tr>
                ))}
                {!leads.length && (
                  <tr>
                    <td colSpan={6} className="muted">
                      <Text>{search || status ? "No matching enquiries." : "No leads yet."}</Text>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <ResultsPagination
          page={page}
          total={total}
          pageSize={pageSize}
          path="/leads"
          filters={{ search, status }}
          label="{count} enquiries · Page {page} of {pages}"
        />
      </main>
    </AppShell>
  );
}
