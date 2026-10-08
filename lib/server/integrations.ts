import "server-only";
import { integrationDestination } from "@/lib/integrations";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlement } from "./workspace";
import type { Database, Json } from "@/lib/supabase/database.types";

type Submission = Database["public"]["Tables"]["submissions"]["Row"];
type Delivery = Database["public"]["Tables"]["integration_deliveries"]["Row"];
export function leadIntegrationPayload(
  id: string,
  lead: Pick<
    Submission,
    "id" | "created_at" | "lead_name" | "lead_email" | "lead_phone" | "answers" | "quote"
  >,
  calculator: { public_id: string; name: string },
) {
  const quote = lead.quote as Record<string, Json>;
  return {
    id,
    event: "enquiry.created",
    created_at: lead.created_at,
    calculator: { id: calculator.public_id, name: calculator.name },
    contact: { name: lead.lead_name, email: lead.lead_email, phone: lead.lead_phone },
    answers: lead.answers,
    estimate: {
      low: quote.low ?? null,
      high: quote.high ?? null,
      currency: quote.currency ?? null,
    },
  };
}
export async function deliverIntegration(url: string, payload: unknown, timeoutMs = 4000) {
  const destination = integrationDestination(url);
  const response = await fetch(destination.url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-service-quote-event": "enquiry.created" },
    body: JSON.stringify(payload),
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  await response.body?.cancel();
  return { ok: response.ok, status: response.status };
}
export async function sendLeadIntegrations(deadline = Date.now() + 18000) {
  const db = createAdminClient();
  let delivered = 0,
    failed = 0,
    cancelled = 0;
  for (let index = 0; index < 20 && Date.now() < deadline - 5000; index++) {
    const { data, error } = await db.rpc("claim_integration_deliveries", { p_limit: 1 });
    if (error) throw error;
    const delivery = (data as unknown as Delivery[])[0];
    if (!delivery) break;
    const update = (values: Database["public"]["Tables"]["integration_deliveries"]["Update"]) =>
      db
        .from("integration_deliveries")
        .update(values)
        .eq("id", delivery.id)
        .eq("claim_token", delivery.claim_token!)
        .eq("status", "pending");
    try {
      const [
        { data: connection, error: connectionError },
        { data: lead, error: leadError },
        entitlement,
      ] = await Promise.all([
        db
          .from("workspace_integrations")
          .select("endpoint_url,enabled,revision")
          .eq("organization_id", delivery.organization_id)
          .maybeSingle(),
        db.from("submissions").select("*").eq("id", delivery.submission_id).maybeSingle(),
        getEntitlement(delivery.organization_id),
      ]);
      if (connectionError || leadError) throw connectionError ?? leadError;
      if (
        !connection?.enabled ||
        connection.revision !== delivery.revision ||
        !["premium", "business"].includes(entitlement.plan) ||
        !lead
      ) {
        const result = await update({ status: "cancelled", claim_token: null });
        if (result.error) throw result.error;
        cancelled++;
        continue;
      }
      const { data: calculator, error: calculatorError } = await db
        .from("calculators")
        .select("public_id,name")
        .eq("id", lead.calculator_id)
        .eq("organization_id", delivery.organization_id)
        .single();
      if (calculatorError) throw calculatorError;
      const result = await deliverIntegration(
        connection.endpoint_url,
        leadIntegrationPayload(delivery.id, lead, calculator),
        Math.min(4000, deadline - Date.now()),
      );
      const updated = await update({
        status: result.ok ? "delivered" : delivery.attempts >= 5 ? "failed" : "pending",
        delivered_at: result.ok ? new Date().toISOString() : null,
        last_status: result.status,
        claim_token: null,
        next_attempt_at: new Date(
          Date.now() + Math.min(60, 2 ** delivery.attempts) * 60000,
        ).toISOString(),
      });
      if (updated.error) throw updated.error;
      if (result.ok) delivered++;
      else failed++;
    } catch {
      const result = await update({
        status: delivery.attempts >= 5 ? "failed" : "pending",
        claim_token: null,
        next_attempt_at: new Date(Date.now() + 15 * 60000).toISOString(),
      });
      if (result.error) throw result.error;
      failed++;
    }
  }
  return { delivered, failed, cancelled };
}
