import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { databaseConfigured, publicSupabaseConfigured } from "./env";
import { HttpError } from "./http";
import { effectivePlan, plans, type Feature } from "@/lib/plans";

export async function requireWorkspace(ownerOnly = false) {
  if (!databaseConfigured() || !publicSupabaseConfigured())
    throw new HttpError(503, "Accounts are not configured");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new HttpError(401, "Sign in to continue");
  const db = createAdminClient();
  const { data: organizationId, error: createError } = await db.rpc(
    "get_or_create_default_organization",
    {
      p_user_id: user.id,
      p_workspace_name: `${user.email?.split("@")[0] ?? "My"}'s workspace`.slice(0, 160),
    },
  );
  if (createError) throw createError;
  const { data: member, error: memberError } = await db
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .single();
  if (memberError) throw memberError;
  if (ownerOnly && member.role !== "owner")
    throw new HttpError(403, "Only the workspace owner can manage billing");
  const entitlement = await getEntitlement(organizationId);
  return { user, db, organizationId, role: member.role, ...entitlement };
}

export async function getEntitlement(organizationId: string) {
  const db = createAdminClient();
  const [organization, subscription] = await Promise.all([
    db
      .from("organizations")
      .select("id,name,trial_ends_at,stripe_account_id")
      .eq("id", organizationId)
      .single(),
    db
      .from("billing_subscriptions")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);
  if (organization.error) throw organization.error;
  if (subscription.error) throw subscription.error;
  return {
    organization: organization.data,
    subscription: subscription.data,
    plan: effectivePlan(subscription.data),
  };
}

export function requireFeature(
  plan: ReturnType<typeof effectivePlan> | null | undefined,
  feature?: Feature,
) {
  if (!plan) throw new HttpError(402, "Choose an active subscription to continue");
  if (feature && !plans[plan][feature])
    throw new HttpError(403, "Upgrade your plan to use this feature");
  return plans[plan];
}

export async function requireCalculator(id: string) {
  const workspace = await requireWorkspace();
  const { data: calculator, error } = await workspace.db
    .from("calculators")
    .select("*")
    .eq("id", id)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();
  if (error) throw error;
  if (!calculator) throw new HttpError(404, "Calculator not found");
  return { ...workspace, calculator };
}
