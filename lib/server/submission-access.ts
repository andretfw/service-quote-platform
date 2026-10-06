import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashAccessToken } from "./security";
import type { Database } from "@/lib/supabase/database.types";

export type AuthorizedSubmission = {
  id: string;
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
    .select("id,quote,status")
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
    quote: { subtotal, currency },
    status: data.status,
  };
}
