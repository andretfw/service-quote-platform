import Link from "next/link";
import PlanCards from "@/components/PlanCards";
import ActionButton from "@/components/ActionButton";
import { pageWorkspace } from "@/lib/server/page-workspace";
import { billingConfigured } from "@/lib/server/billing";
import { plans } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const workspace = await pageWorkspace();
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const [usage, calculators] = await Promise.all([
    workspace.db
      .from("workspace_usage")
      .select("leads")
      .eq("organization_id", workspace.organizationId)
      .eq("month", month)
      .maybeSingle(),
    workspace.db
      .from("calculators")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", workspace.organizationId)
      .is("archived_at", null),
  ]);
  if (usage.error || calculators.error) throw new Error("Unable to load subscription usage");
  const configured = billingConfigured();
  return (
    <main className="shell">
      <nav className="nav">
        <Link className="brand" href="/dashboard">
          ← Dashboard
        </Link>
        <Link href="/workspace">My calculators</Link>
      </nav>
      <h1>Subscription and usage</h1>
      <div className="card">
        <h2>{workspace.plan ? plans[workspace.plan].name : "Subscription required"}</h2>
        <p>
          {workspace.subscription
            ? `Billing status: ${workspace.subscription.status}. Current period ends ${new Date(workspace.subscription.current_period_end).toLocaleDateString("en")}.`
            : `Basic trial ends ${new Date(workspace.organization.trial_ends_at).toLocaleDateString("en")}.`}
        </p>
        <p>
          {calculators.count ?? 0} calculators · {usage.data?.leads ?? 0} enquiries this month
        </p>
        {workspace.subscription?.cancel_at_period_end && (
          <p>Cancellation is scheduled. Access continues until the paid period ends.</p>
        )}
        {workspace.role === "owner" && workspace.subscription && (
          <ActionButton endpoint="/api/billing/portal">
            Manage plan, invoices and cancellation
          </ActionButton>
        )}
      </div>
      {!configured && (
        <p className="notice">
          Subscription checkout will be available after the platform owner completes payment setup.
        </p>
      )}
      {workspace.role === "owner" ? (
        <PlanCards checkout configured={configured} />
      ) : (
        <p>Contact your workspace owner to change the subscription.</p>
      )}
    </main>
  );
}
