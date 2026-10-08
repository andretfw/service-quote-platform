import AppShell from "@/components/AppShell";
import ConnectionSettings from "@/components/ConnectionSettings";
import { Text } from "@/components/Language";
import Link from "next/link";
import { pageWorkspace } from "@/lib/server/page-workspace";
import { plans } from "@/lib/plans";
import { uiLocale } from "@/lib/server/locale";
export const dynamic = "force-dynamic";
export default async function ConnectionsPage() {
  const workspace = await pageWorkspace();
  const locale = await uiLocale();
  const [connection, deliveries] = await Promise.all([
    workspace.db
      .from("workspace_integrations")
      .select("endpoint_url,enabled,provider")
      .eq("organization_id", workspace.organizationId)
      .maybeSingle(),
    workspace.db
      .from("integration_deliveries")
      .select("id,status,attempts,created_at,last_status")
      .eq("organization_id", workspace.organizationId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (connection.error || deliveries.error) throw new Error("Unable to load connections");
  return (
    <AppShell>
      <main className="shell app-page">
        <h1>
          <Text>Connections</Text>
        </h1>
        <p className="muted">
          <Text>Keep your leads moving into the tools you already use.</Text>
        </p>
        <div className="connection-layout">
          <ConnectionSettings
            connection={workspace.role === "owner" ? connection.data : null}
            allowed={plans[workspace.plan].integrations}
            owner={workspace.role === "owner"}
          />
          <section className="card">
            <h2>
              <Text>Set it up in three steps</Text>
            </h2>
            <ol className="setup-steps">
              <li>
                <Text>
                  Create a Catch Hook in Zapier or a custom webhook in Make. Copy its HTTPS URL.
                </Text>
              </li>
              <li>
                <Text>
                  Paste the URL here and save. Send a sample while your automation tool is
                  listening.
                </Text>
              </li>
              <li>
                <Text>
                  Map the sample fields to your spreadsheet or CRM, turn on that workflow and enable
                  automatic delivery here.
                </Text>
              </li>
            </ol>
            <p className="small muted">
              <Text>
                Your automation account may have its own fees. Existing leads are not imported.
                Deliveries can repeat after a retry; use the event ID to avoid duplicates.
              </Text>
            </p>
            <Link className="text-link" href="/integrations">
              <Text>Explore integrations</Text> →
            </Link>
          </section>
        </div>
        <section className="card connection-log">
          <h2>
            <Text>Recent deliveries</Text>
          </h2>
          {!deliveries.data.length ? (
            <p className="muted">
              <Text>
                No deliveries yet. Enable your connection, then submit a new enquiry to a saved
                calculator.
              </Text>
            </p>
          ) : (
            <dl className="answer-details">
              {deliveries.data.map((row) => (
                <div key={row.id}>
                  <dt>
                    <Text>
                      {row.status === "delivered"
                        ? "Delivered"
                        : row.status === "failed"
                          ? "Failed"
                          : row.status === "cancelled"
                            ? "Cancelled"
                            : "Pending"}
                    </Text>{" "}
                    · {row.attempts} <Text>attempts</Text>
                  </dt>
                  <dd className="small muted">
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "UTC",
                    }).format(new Date(row.created_at))}{" "}
                    UTC {row.last_status ? `· HTTP ${row.last_status}` : ""}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="small muted">
            <Text>
              Failed requests retry up to five attempts. Check your automation tool if a delivery
              fails. A delivered event means the tool accepted it, not that every downstream step
              completed.
            </Text>
          </p>
        </section>
      </main>
    </AppShell>
  );
}
