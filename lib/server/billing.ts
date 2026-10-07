import "server-only";
import Stripe from "stripe";
import { isPlanId, planIds, pricingApproved, type PlanId } from "@/lib/plans";
import { getStripeEnv } from "./env";
import { HttpError } from "./http";
import { createAdminClient } from "@/lib/supabase/admin";

export const billingStripe = () => new Stripe(getStripeEnv().secretKey);
export const priceId = (plan: PlanId) => {
  const id = process.env[`STRIPE_PRICE_${plan.toUpperCase()}`]?.trim();
  if (!id) throw new HttpError(503, "This subscription plan is not configured");
  return id;
};
export const billingConfigured = () =>
  Boolean(
    pricingApproved() &&
      process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_BILLING_WEBHOOK_SECRET &&
      planIds.every((plan) => process.env[`STRIPE_PRICE_${plan.toUpperCase()}`]),
  );

export async function syncSubscription(subscriptionId: string) {
  const observedAt = new Date().toISOString();
  const stripe = billingStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const organizationId = subscription.metadata.organization_id;
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  if (!organizationId) throw new Error("Subscription has no workspace reference");
  const db = createAdminClient();
  const { data: organization, error } = await db
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", organizationId)
    .single();
  if (error) throw error;
  if (organization.stripe_customer_id !== customerId)
    throw new Error("Subscription customer does not match workspace");
  const item = subscription.items.data[0];
  if (!item || subscription.items.data.length !== 1)
    throw new Error("Unexpected subscription items");
  const matched = planIds.find(
    (plan) => process.env[`STRIPE_PRICE_${plan.toUpperCase()}`] === item.price.id,
  );
  const plan =
    matched ?? (isPlanId(subscription.metadata.plan) ? subscription.metadata.plan : "basic");
  const status = matched && !subscription.pause_collection ? subscription.status : "unpaid";
  const periodEnd = new Date(item.current_period_end * 1000).toISOString();
  const { error: syncError } = await db.rpc("sync_billing_subscription", {
    p_organization_id: organizationId,
    p_customer_id: customerId,
    p_subscription_id: subscription.id,
    p_plan: plan,
    p_status: status,
    p_observed_at: observedAt,
    p_period_end: periodEnd,
    p_cancel_at_period_end: subscription.cancel_at_period_end,
  });
  if (syncError) throw syncError;
}
