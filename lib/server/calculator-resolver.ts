import "server-only";
import { getEntitlement } from "./workspace";
import { plans, type PlanId } from "@/lib/plans";
import { databaseConfigured } from "@/lib/server/env";
import { quoteTemplateSchema } from "@/lib/server/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTemplate } from "@/lib/templates";
import type { PublicQuoteConfig, QuoteTemplate } from "@/lib/types";

export type ResolvedCalculator = {
  publicId: string;
  calculatorId: string | null;
  template: QuoteTemplate;
  organizationId?: string;
  plan?: PlanId | null;
  stripeAccountId?: string | null;
};

export function toPublicQuoteConfig(resolved: ResolvedCalculator): PublicQuoteConfig {
  const { template } = resolved;

  return {
    publicId: resolved.publicId,
    name: template.name,
    industry: template.industry,
    description: template.description,
    currency: template.currency,
    questions: template.questions,
    canCaptureLeads: resolved.calculatorId !== null && Boolean(resolved.plan),
    businessName:
      resolved.plan && plans[resolved.plan].branding ? template.settings?.businessName : undefined,
    accentColor:
      resolved.plan && plans[resolved.plan].branding ? template.settings?.accentColor : undefined,
    canRequestBooking: Boolean(
      resolved.plan && plans[resolved.plan].bookings && template.settings?.bookingRequests,
    ),
    canPayDeposit: Boolean(
      resolved.plan &&
        plans[resolved.plan].deposits &&
        template.settings?.deposits &&
        resolved.stripeAccountId,
    ),
    canFollowUp: Boolean(
      resolved.plan && plans[resolved.plan].followUps && template.settings?.followUps,
    ),
  };
}

export async function resolveCalculator(publicId: string): Promise<ResolvedCalculator | null> {
  const bundled = getTemplate(publicId);
  if (bundled) {
    return { publicId, calculatorId: null, template: bundled };
  }

  if (!databaseConfigured()) return null;

  const db = createAdminClient();
  const { data: calculator, error: calculatorError } = await db
    .from("calculators")
    .select("id,name,template_slug,active_version,organization_id")
    .eq("public_id", publicId)
    .is("archived_at", null)
    .maybeSingle();

  if (calculatorError) throw calculatorError;
  if (!calculator) return null;

  const { data: version, error: versionError } = await db
    .from("calculator_versions")
    .select("schema,pricing_rules")
    .eq("calculator_id", calculator.id)
    .eq("version", calculator.active_version)
    .maybeSingle();

  if (versionError) throw versionError;
  if (!version) return null;

  const schema = version.schema as Record<string, unknown>;
  const parsed = quoteTemplateSchema.safeParse({
    ...schema,
    name: calculator.name,
    slug: calculator.template_slug,
    rules: version.pricing_rules,
  });

  if (!parsed.success) {
    throw new Error(`Calculator ${publicId} has an invalid active configuration`);
  }

  const entitlement = await getEntitlement(calculator.organization_id);
  const { data: enabled, error: enabledError } = await db.rpc("calculator_accepts_leads", {
    p_calculator_id: calculator.id,
  });
  if (enabledError) throw enabledError;
  if (entitlement.plan && !enabled) return null;
  return {
    organizationId: calculator.organization_id,
    plan: entitlement.plan,
    stripeAccountId: entitlement.organization.stripe_account_id,
    publicId,
    calculatorId: calculator.id,
    template: parsed.data,
  };
}
