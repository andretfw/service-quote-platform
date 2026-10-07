import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { answersSchema, quoteTemplateSchema } from "./schemas";
import { answerSummary, formatEstimate } from "@/lib/lead-summary";
import { getTemplate } from "@/lib/templates";
import { requireWorkspace } from "./workspace";

export type LeadRecord = Database["public"]["Tables"]["submissions"]["Row"];
export const leadColumns =
  "id,calculator_id,template_slug,answers,quote,lead_name,lead_email,lead_phone,status,follow_up_count,follow_up_consent,created_at" as const;

export async function leadPresentation(
  db: SupabaseClient<Database>,
  lead: Pick<LeadRecord, "calculator_id" | "template_slug" | "answers" | "quote" | "created_at">,
) {
  const { data: version, error } = await db
    .from("calculator_versions")
    .select("schema,pricing_rules")
    .eq("calculator_id", lead.calculator_id)
    .lte("created_at", lead.created_at)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const schema = version?.schema;
  const parsed =
    schema && typeof schema === "object" && !Array.isArray(schema)
      ? quoteTemplateSchema.safeParse({ ...schema, rules: version.pricing_rules })
      : null;
  const template = parsed?.success ? parsed.data : getTemplate(lead.template_slug);
  const answers = answersSchema.safeParse(lead.answers);
  return {
    name: template?.name ?? "Quote request",
    estimate: formatEstimate(lead.quote),
    answers: answerSummary(template?.questions ?? [], answers.success ? answers.data : {}),
  };
}

export async function workspaceLead(
  workspace: Awaited<ReturnType<typeof requireWorkspace>>,
  id: string,
) {
  const { data: lead, error } = await workspace.db
    .from("submissions")
    .select(leadColumns)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!lead) return null;
  const { data: calculator, error: calculatorError } = await workspace.db
    .from("calculators")
    .select("id")
    .eq("id", lead.calculator_id)
    .eq("organization_id", workspace.organizationId)
    .maybeSingle();
  if (calculatorError) throw calculatorError;
  return calculator ? lead : null;
}
