import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeEnv } from "@/lib/server/env";
import { createAdminClient } from "@/lib/supabase/admin";

const webhookError = (message: string, status = 500) =>
  NextResponse.json({ error: message }, { status });

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const { secretKey, webhookSecret } = getStripeEnv();

  if (!signature || !webhookSecret) {
    return webhookError("Webhook is not configured", 503);
  }

  const stripe = new Stripe(secretKey);
  let event: Stripe.Event;

  try {
    const payload = await request.text();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return webhookError("Invalid webhook signature", 400);
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.expired") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  const db = createAdminClient();
  const { data: payment, error: paymentError } = await db
    .from("payments")
    .select("id,submission_id,amount_cents,currency,status")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  if (paymentError) return webhookError("Could not load payment");
  if (!payment) return webhookError("Payment record not found", 404);

  if (session.client_reference_id !== payment.submission_id) {
    return webhookError("Checkout reference mismatch", 400);
  }

  if (event.type === "checkout.session.completed") {
    const amountMatches = session.amount_total === payment.amount_cents;
    const currencyMatches = session.currency?.toLowerCase() === payment.currency.toLowerCase();

    if (session.payment_status !== "paid" || !amountMatches || !currencyMatches) {
      return webhookError("Checkout payment details did not match the stored payment", 400);
    }

    const { error: updateError } = await db
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", payment.id)
      .neq("status", "paid");

    if (updateError) return webhookError("Could not update payment");
  } else if (payment.status === "pending") {
    const { error: updateError } = await db
      .from("payments")
      .update({ status: "failed" })
      .eq("id", payment.id)
      .eq("status", "pending");

    if (updateError) return webhookError("Could not expire payment");
  }

  return NextResponse.json({ received: true });
}
