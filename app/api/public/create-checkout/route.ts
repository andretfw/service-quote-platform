import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  databaseConfigured,
  getAppUrl,
  getDepositPercent,
  getStripeEnv,
  stripeConfigured,
} from "@/lib/server/env";
import { HttpError, parseJson, publicApiError } from "@/lib/server/http";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { checkoutRequestSchema } from "@/lib/server/schemas";
import { getAuthorizedSubmission } from "@/lib/server/submission-access";
import { createAdminClient } from "@/lib/supabase/admin";

const stripeSessionUsable = (session: Stripe.Checkout.Session): boolean =>
  session.status === "open" && Boolean(session.url);

export async function POST(request: Request) {
  try {
    await assertRateLimit(request, "checkout", 10, 600);
    if (!databaseConfigured() || !stripeConfigured()) {
      throw new HttpError(503, "Payments are not configured");
    }

    const body = await parseJson(request, checkoutRequestSchema);
    const db = createAdminClient();
    const submission = await getAuthorizedSubmission(db, body.submissionId, body.accessToken);
    if (!submission) throw new HttpError(404, "Submission not found");
    if (submission.status === "lost") throw new HttpError(409, "This submission is closed");

    const percent = getDepositPercent();
    const amountCents = Math.max(50, Math.round(submission.quote.subtotal * (percent / 100) * 100));
    const currency = submission.quote.currency.toLowerCase();
    const { secretKey } = getStripeEnv();
    const stripe = new Stripe(secretKey);

    const { data: paidPayment, error: paidPaymentError } = await db
      .from("payments")
      .select("id")
      .eq("submission_id", submission.id)
      .eq("status", "paid")
      .limit(1)
      .maybeSingle();

    if (paidPaymentError) throw paidPaymentError;
    if (paidPayment) throw new HttpError(409, "This deposit has already been paid");

    const { data: existingPayment, error: existingError } = await db
      .from("payments")
      .select("id,stripe_checkout_session_id")
      .eq("submission_id", submission.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingPayment) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        existingPayment.stripe_checkout_session_id,
      );

      if (stripeSessionUsable(existingSession)) {
        return NextResponse.json({ url: existingSession.url });
      }

      const { error: staleError } = await db
        .from("payments")
        .update({ status: existingSession.payment_status === "paid" ? "paid" : "failed" })
        .eq("id", existingPayment.id)
        .eq("status", "pending");
      if (staleError) throw staleError;

      if (existingSession.payment_status === "paid") {
        throw new HttpError(409, "This deposit has already been paid");
      }
    }

    const origin = getAppUrl(new URL(request.url).origin);
    const idempotencyBucket = Math.floor(Date.now() / (60 * 1000));
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: submission.id,
        metadata: { submission_id: submission.id, deposit_percent: String(percent) },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: amountCents,
              product_data: { name: `Service deposit (${percent}%)` },
            },
          },
        ],
        success_url: `${origin}/?payment=success`,
        cancel_url: `${origin}/?payment=cancelled`,
      },
      {
        idempotencyKey: `deposit:${submission.id}:${amountCents}:${currency}:${idempotencyBucket}`,
      },
    );

    if (!session.url) throw new Error("Stripe checkout session did not return a URL");

    const { error: insertError } = await db.from("payments").insert({
      submission_id: submission.id,
      stripe_checkout_session_id: session.id,
      amount_cents: amountCents,
      currency,
      status: "pending",
    });

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: concurrentPayment } = await db
          .from("payments")
          .select("stripe_checkout_session_id")
          .eq("submission_id", submission.id)
          .eq("status", "pending")
          .limit(1)
          .maybeSingle();

        if (concurrentPayment) {
          const concurrentSession = await stripe.checkout.sessions.retrieve(
            concurrentPayment.stripe_checkout_session_id,
          );
          if (stripeSessionUsable(concurrentSession)) {
            return NextResponse.json({ url: concurrentSession.url });
          }
        }
      }
      throw insertError;
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const { status, message } = publicApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
