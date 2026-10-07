import { Text } from "@/components/Language";
import AppShell from "@/components/AppShell";
import Link from "next/link";
import { pageWorkspace } from "@/lib/server/page-workspace";
import ActionButton from "@/components/ActionButton";
import { plans } from "@/lib/plans";

export const dynamic = "force-dynamic";
export default async function WorkspacePage() {
  const workspace = await pageWorkspace();
  const { data, error } = await workspace.db
    .from("calculators")
    .select("id,name,public_id,active_version,archived_at")
    .eq("organization_id", workspace.organizationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load calculators");
  return (
    <AppShell>
      <main className="shell app-page">
        <h1>
          <Text>{"My calculators"}</Text>
        </h1>
        <p className="muted">
          <Text>
            {
              "Archive calculators to free a plan slot while keeping their leads. After a downgrade, the oldest active calculators remain available within the new plan limit."
            }
          </Text>
        </p>
        {!workspace.plan && (
          <p className="notice">
            <Text>{"Your subscription is inactive."}</Text>{" "}
            <Link href="/billing">
              <Text>{"Choose a plan"}</Text>
            </Link>{" "}
            <Text>{"to accept new enquiries."}</Text>
          </p>
        )}
        <div className="grid">
          {data.map((c) => (
            <div className="card" key={c.id}>
              <h2>
                <Text>{c.name}</Text>
              </h2>
              <p className="muted">
                <Text>{"Revision"}</Text> {c.active_version}
                <Text>{c.archived_at ? " · Archived" : ""}</Text>
              </p>
              <div className="row">
                <Link className="btn" href={`/builder/${c.id}`}>
                  <Text>{"Edit"}</Text>
                </Link>
                {!c.archived_at && (
                  <Link href={`/q/${c.public_id}`}>
                    <Text>{"Open calculator"}</Text>
                  </Link>
                )}
                <ActionButton
                  endpoint={`/api/calculators/${c.id}/archive`}
                  body={{ archived: !c.archived_at }}
                >
                  <Text>{c.archived_at ? "Restore" : "Archive"}</Text>
                </ActionButton>
              </div>
            </div>
          ))}
        </div>
        {!data.length && (
          <p>
            <Text>{"Create your first calculator from one of the 15 templates."}</Text>
          </p>
        )}
        {workspace.plan && plans[workspace.plan].deposits && (
          <div className="card">
            <h2>
              <Text>{"Receive service deposits"}</Text>
            </h2>
            <p>
              <Text>
                {
                  "Connect your own Stripe account so customer deposits are collected by your business. Stripe will ask you for business verification details."
                }
              </Text>
            </p>
            <ActionButton endpoint="/api/billing/connect">
              <Text>
                {workspace.organization.stripe_account_id
                  ? "Update Stripe account"
                  : "Connect Stripe account"}
              </Text>
            </ActionButton>
          </div>
        )}
      </main>
    </AppShell>
  );
}
