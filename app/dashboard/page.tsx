import AppShell from "@/components/AppShell";
import DashboardOverview from "@/components/DashboardOverview";
import { pageWorkspace } from "@/lib/server/page-workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const workspace = await pageWorkspace();
  const supabase = await createSupabaseServerClient();
  const { data: calculators, error: calculatorError } = await workspace.db
    .from("calculators")
    .select("id")
    .eq("organization_id", workspace.organizationId);
  if (calculatorError) throw new Error("Unable to load business calculators");
  const { data, error } = await supabase
    .from("submissions")
    .select("id,lead_name,template_slug,quote,status,created_at")
    .in(
      "calculator_id",
      calculators.map((calculator) => calculator.id),
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error("Unable to load dashboard data");
  return (
    <AppShell>
      <main className="shell app-page">
        <DashboardOverview leads={data ?? []} />
      </main>
    </AppShell>
  );
}
