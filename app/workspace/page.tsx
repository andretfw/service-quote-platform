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
    <main className="shell">
      <nav className="nav">
        <Link className="brand" href="/dashboard">
          ← Dashboard
        </Link>
        <Link href="/billing">Subscription</Link>
        <Link className="btn" href="/calculators">
          New calculator
        </Link>
      </nav>
      <h1>My calculators</h1>
      <p className="muted">
        Archive calculators to free a plan slot while keeping their leads. After a downgrade, the
        oldest active calculators remain available within the new plan limit.
      </p>
      {!workspace.plan && (
        <p className="notice">
          Your subscription is inactive. <Link href="/billing">Choose a plan</Link> to accept new
          enquiries.
        </p>
      )}
      <div className="grid">
        {data.map((c) => (
          <div className="card" key={c.id}>
            <h2>{c.name}</h2>
            <p className="muted">
              Revision {c.active_version}
              {c.archived_at ? " · Archived" : ""}
            </p>
            <div className="row">
              <Link className="btn" href={`/builder/${c.id}`}>
                Edit
              </Link>
              {!c.archived_at && <Link href={`/q/${c.public_id}`}>Open calculator</Link>}
              <ActionButton
                endpoint={`/api/calculators/${c.id}/archive`}
                body={{ archived: !c.archived_at }}
              >
                {c.archived_at ? "Restore" : "Archive"}
              </ActionButton>
            </div>
          </div>
        ))}
      </div>
      {!data.length && <p>Create your first calculator from one of the 15 templates.</p>}
      {workspace.plan && plans[workspace.plan].deposits && (
        <div className="card">
          <h2>Receive service deposits</h2>
          <p>
            Connect your own Stripe account so customer deposits are collected by your business.
            Stripe will ask you for business verification details.
          </p>
          <ActionButton endpoint="/api/billing/connect">
            {workspace.organization.stripe_account_id
              ? "Update Stripe account"
              : "Connect Stripe account"}
          </ActionButton>
        </div>
      )}
    </main>
  );
}
