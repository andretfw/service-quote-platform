import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCalculator } from "./calculator-resolver";
import { HttpError } from "./http";
import { requireFeature } from "./workspace";
import type { Feature } from "@/lib/plans";

export async function customerCalculator(calculatorId: string, feature: Feature) {
  const { data, error } = await createAdminClient()
    .from("calculators")
    .select("public_id")
    .eq("id", calculatorId)
    .single();
  if (error) throw error;
  const resolved = await resolveCalculator(data.public_id);
  if (!resolved) throw new HttpError(404, "Calculator not found");
  requireFeature(resolved.plan ?? null, feature);
  if (feature === "followUps" && !resolved.template.settings?.followUps)
    throw new HttpError(403, "Follow-ups are disabled");
  if (feature === "bookings" && !resolved.template.settings?.bookingRequests)
    throw new HttpError(403, "Booking requests are disabled");
  if (feature === "deposits" && !resolved.template.settings?.deposits)
    throw new HttpError(403, "Deposits are disabled");
  return resolved;
}
