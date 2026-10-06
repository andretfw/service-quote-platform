import "server-only";
import { databaseConfigured } from "@/lib/server/env";
import { quoteTemplateSchema } from "@/lib/server/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTemplate } from "@/lib/templates";
import type { PublicQuoteConfig, QuoteTemplate } from "@/lib/types";

export type ResolvedCalculator = {
  publicId: string;
  calculatorId: string | null;
  template: QuoteTemplate;
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
    canCaptureLeads: resolved.calculatorId !== null,
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
    .select("id,name,template_slug,active_version")
    .eq("public_id", publicId)
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

  return {
    publicId,
    calculatorId: calculator.id,
    template: parsed.data,
  };
}
