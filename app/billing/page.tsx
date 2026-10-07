import { uiLocale } from "@/lib/server/locale";
import { translate } from "@/lib/i18n";
import { Text } from "@/components/Language";
import AppShell from "@/components/AppShell";
import PlanCards from "@/components/PlanCards";
import ActionButton from "@/components/ActionButton";
import { pageWorkspace } from "@/lib/server/page-workspace";
import { billingConfigured } from "@/lib/server/billing";
import { plans } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const locale = await uiLocale();
  const t = (source: string) => translate(source, locale);
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
    <AppShell>
      <main className="shell app-page">
        <h1>
          <Text>{"Subscription and usage"}</Text>
        </h1>
        <div className="card">
          <h2>
            <Text>{workspace.plan ? plans[workspace.plan].name : "Subscription required"}</Text>
          </h2>
          <p>
            {workspace.subscription
              ? `${t("Billing status")}: ${t(workspace.subscription.status)}. ${t("Current period ends")} ${new Date(workspace.subscription.current_period_end).toLocaleDateString(locale)}.`
              : t("Free forever. No card required.")}
          </p>
          <p>
            {calculators.count ?? 0} / {plans[workspace.plan].calculators}{" "}
            <Text>{"calculators ·"}</Text>
            {usage.data?.leads ?? 0} / {plans[workspace.plan].monthlyLeads}{" "}
            <Text>{"enquiries this month"}</Text>
          </p>
          {workspace.plan === "free" && workspace.subscription && (
            <p>
              <Text>
                {"Your workspace is on Free. Paid features require an active subscription."}
              </Text>
            </p>
          )}
          {workspace.subscription?.cancel_at_period_end && (
            <p>
              <Text>
                {
                  "Cancellation is scheduled. Paid access continues until the period ends, then your workspace returns to Free."
                }
              </Text>
            </p>
          )}
          {workspace.role === "owner" && workspace.subscription && (
            <div id="billing-management">
              <ActionButton endpoint="/api/billing/portal">
                <Text>{"Manage plan, invoices and cancellation"}</Text>
              </ActionButton>
              <p className="muted">
                <Text>
                  {
                    "To switch to Free, cancel your paid subscription. Your saved calculators and leads are retained."
                  }
                </Text>
              </p>
            </div>
          )}
        </div>
        {!configured && (
          <p className="notice">
            <Text>
              {
                "Subscription checkout will be available after the platform owner completes payment setup."
              }
            </Text>
          </p>
        )}
        {workspace.role === "owner" ? (
          <PlanCards checkout configured={configured} currentPlan={workspace.plan} />
        ) : (
          <p>
            <Text>{"Contact your workspace owner to change the subscription."}</Text>
          </p>
        )}
      </main>
    </AppShell>
  );
}
