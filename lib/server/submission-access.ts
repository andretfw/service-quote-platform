import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashAccessToken } from "./security";
import type { Database } from "@/lib/supabase/database.types";

export type AuthorizedSubmission = {
  id: string;
  calculatorId: string;
  leadEmail: string | null;
  quote: { subtotal: number; currency: string };
  status: string;
};

export async function getAuthorizedSubmission(
  db: SupabaseClient<Database>,
  submissionId: string,
  accessToken: string,
): Promise<AuthorizedSubmission | null> {
  const { data, error } = await db
    .from("submissions")
    .select("id,calculator_id,quote,status,lead_email")
    .eq("id", submissionId)
    .eq("access_token_hash", hashAccessToken(accessToken))
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const quote = data.quote as { subtotal?: unknown; currency?: unknown };
  const subtotal = Number(quote?.subtotal);
  const currency = typeof quote?.currency === "string" ? quote.currency : "";
  if (!Number.isFinite(subtotal) || subtotal <= 0 || !currency) return null;

  return {
    id: data.id,
    calculatorId: data.calculator_id,
    leadEmail: data.lead_email,
    quote: { subtotal, currency },
    status: data.status,
  };
}
