import { readBody } from "@/lib/server/http";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { billingStripe, syncSubscription } from "@/lib/server/billing";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET?.trim();
  if (!signature || !secret || !process.env.STRIPE_SECRET_KEY)
    return NextResponse.json({ error: "Billing webhook is not configured" }, { status: 503 });
  let event: Stripe.Event;
  try {
    event = billingStripe().webhooks.constructEvent(
      await readBody(request, 1024 * 1024),
      signature,
      secret,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    if (event.type.startsWith("customer.subscription.")) {
      const object = event.data.object as Stripe.Subscription;
      await syncSubscription(object.id);
    } else if (
      ["invoice.paid", "invoice.payment_failed", "invoice.payment_action_required"].includes(
        event.type,
      )
    ) {
      const invoice = event.data.object as Stripe.Invoice;
      const subscription = invoice.parent?.subscription_details?.subscription;
      if (subscription)
        await syncSubscription(typeof subscription === "string" ? subscription : subscription.id);
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Billing synchronization failed; retry delivery" },
      { status: 500 },
    );
  }
}
