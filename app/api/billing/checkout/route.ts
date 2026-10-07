import { NextResponse } from "next/server";
import { z } from "zod";
import { plans } from "@/lib/plans";
import { assertSameOrigin, HttpError, parseJson, publicApiError } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/workspace";
import { billingConfigured, billingStripe, priceId } from "@/lib/server/billing";
import { getAppUrl } from "@/lib/server/env";
import { assertRateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "billing-checkout", 10, 600);
    if (!billingConfigured())
      throw new HttpError(503, "Subscription billing is not configured yet");
    const { plan } = await parseJson(
      request,
      z.object({ plan: z.enum(["basic", "premium", "business"]) }),
    );
    const workspace = await requireWorkspace(true);
    const stripe = billingStripe();
    const { data: record, error } = await workspace.db
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", workspace.organizationId)
      .single();
    if (error) throw error;
    let customerId = record.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create(
        { email: workspace.user.email, metadata: { organization_id: workspace.organizationId } },
        { idempotencyKey: `workspace-customer:${workspace.organizationId}` },
      );
      customerId = customer.id;
      const { error: saveError } = await workspace.db
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", workspace.organizationId);
      if (saveError) throw saveError;
    }
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    });
    if (subscriptions.data.some((s) => !["canceled", "incomplete_expired"].includes(s.status)))
      throw new HttpError(409, "Manage your existing subscription in the billing portal");
    const approvedPrice = plans[plan].monthlyEur;
    if (approvedPrice === null)
      throw new HttpError(503, "Subscription pricing is not available yet");
    const price = await stripe.prices.retrieve(priceId(plan));
    if (
      !price.active ||
      price.currency !== "eur" ||
      price.unit_amount !== approvedPrice * 100 ||
      price.recurring?.interval !== "month" ||
      price.recurring.interval_count !== 1
    )
      throw new HttpError(503, "Subscription price does not match the published plan");
    const { data: reservationData, error: reservationError } = await workspace.db.rpc(
      "reserve_subscription_checkout",
      { p_organization_id: workspace.organizationId, p_plan: plan },
    );
    if (reservationError) {
      if (reservationError.code === "P0001") throw new HttpError(409, reservationError.message);
      throw reservationError;
    }
    const reservation = reservationData as {
      token: string;
      plan: string;
      expires_at: string;
      stripe_session_id: string | null;
    };
    if (reservation.plan !== plan)
      throw new HttpError(
        409,
        "A checkout for another plan is already open. Finish it or wait 31 minutes before choosing another plan.",
      );
    if (reservation.stripe_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(reservation.stripe_session_id);
      if (existing.status === "open" && existing.url)
        return NextResponse.json({ url: existing.url });
      throw new HttpError(
        409,
        "Checkout has finished. Refresh billing shortly or wait for the checkout reservation to expire.",
      );
    }
    const origin = getAppUrl(new URL(request.url).origin);
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        expires_at: Math.floor(new Date(reservation.expires_at).getTime() / 1000),
        line_items: [{ price: price.id, quantity: 1 }],
        client_reference_id: workspace.organizationId,
        subscription_data: { metadata: { organization_id: workspace.organizationId, plan } },
        success_url: `${origin}/billing?checkout=success`,
        cancel_url: `${origin}/billing`,
        billing_address_collection: "required",
      },
      { idempotencyKey: `subscription:${reservation.token}` },
    );
    const { error: saveSessionError } = await workspace.db
      .from("billing_checkout_reservations")
      .update({ stripe_session_id: session.id })
      .eq("organization_id", workspace.organizationId)
      .eq("token", reservation.token);
    if (saveSessionError) throw saveSessionError;
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const result = publicApiError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
