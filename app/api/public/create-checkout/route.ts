import { NextResponse } from "next/server";
import Stripe from "stripe";
import { customerCalculator } from "@/lib/server/customer-calculator";
import { databaseConfigured, getAppUrl, getStripeEnv, stripeConfigured } from "@/lib/server/env";
import { HttpError, parseJson, publicApiError } from "@/lib/server/http";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { checkoutRequestSchema } from "@/lib/server/schemas";
import { getAuthorizedSubmission } from "@/lib/server/submission-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    await assertRateLimit(request, "checkout", 10, 600);
    if (!databaseConfigured() || !stripeConfigured())
      throw new HttpError(503, "Payments are not configured");
    const body = await parseJson(request, checkoutRequestSchema);
    const db = createAdminClient();
    const submission = await getAuthorizedSubmission(db, body.submissionId, body.accessToken);
    if (!submission) throw new HttpError(404, "Submission not found");
    if (["lost", "won"].includes(submission.status))
      throw new HttpError(409, "This submission is closed");
    const calculator = await customerCalculator(submission.calculatorId, "deposits");
    const accountId = calculator.stripeAccountId;
    if (!accountId) throw new HttpError(503, "The business has not connected its payment account");
    const stripe = new Stripe(getStripeEnv().secretKey);
    const account = await stripe.accounts.retrieve(accountId);
    if (!account.charges_enabled || !account.payouts_enabled)
      throw new HttpError(503, "The business's payment account is not ready");
    const percent = calculator.template.settings?.depositPercent ?? 20;
    const amountCents = Math.round(submission.quote.subtotal * percent);
    const currency = submission.quote.currency.toLowerCase();
    if (!Number.isSafeInteger(amountCents) || amountCents < 50)
      throw new HttpError(400, "This estimate is too small for a card deposit");
    const { data: reservationData, error: reservationError } = await db.rpc(
      "reserve_deposit_checkout",
      {
        p_submission_id: submission.id,
        p_account_id: accountId,
        p_amount_cents: amountCents,
        p_currency: currency,
      },
    );
    if (reservationError) {
      if (reservationError.code === "P0001") throw new HttpError(409, reservationError.message);
      throw reservationError;
    }
    const reservation = reservationData as {
      token: string;
      stripe_account_id: string;
      amount_cents: number;
      currency: string;
      expires_at: string;
      stripe_session_id: string | null;
    };
    if (reservation.stripe_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(
        reservation.stripe_session_id,
        {},
        { stripeAccount: reservation.stripe_account_id },
      );
      if (existing.payment_status === "paid")
        throw new HttpError(409, "This deposit has already been paid");
      if (existing.status === "open" && existing.url)
        return NextResponse.json({ url: existing.url });
      if (existing.status === "expired") {
        const { error: releaseError } = await db.rpc("release_expired_deposit_checkout", {
          p_submission_id: submission.id,
          p_token: reservation.token,
        });
        if (releaseError) throw releaseError;
        throw new HttpError(
          409,
          "The previous checkout expired. Click Pay deposit again to open a new checkout.",
        );
      }
      throw new HttpError(409, "The previous checkout is awaiting payment confirmation");
    }
    if (reservation.stripe_account_id !== accountId)
      throw new HttpError(
        409,
        "The business changed its payment account. Contact the business before paying.",
      );
    const origin = getAppUrl(new URL(request.url).origin);
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        expires_at: Math.floor(new Date(reservation.expires_at).getTime() / 1000),
        allowed_payment_method_types: ["card"],
        customer_email: submission.leadEmail ?? undefined,
        client_reference_id: submission.id,
        metadata: { submission_id: submission.id },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: reservation.currency,
              unit_amount: reservation.amount_cents,
              product_data: { name: "Service deposit" },
            },
          },
        ],
        success_url: `${origin}/payment/success`,
        cancel_url: `${origin}/payment/cancelled`,
      },
      {
        stripeAccount: accountId,
        idempotencyKey: `deposit:${reservation.token}`,
      },
    );
    if (!session.url) throw new Error("No checkout URL");
    const { error: registerError } = await db.rpc("register_deposit_checkout", {
      p_submission_id: submission.id,
      p_token: reservation.token,
      p_session_id: session.id,
    });
    if (registerError) throw registerError;
    const canonical = await stripe.checkout.sessions.retrieve(
      session.id,
      {},
      { stripeAccount: accountId },
    );
    if (canonical.payment_status === "paid")
      throw new HttpError(409, "This deposit has already been paid");
    if (canonical.status !== "open" || !canonical.url)
      throw new HttpError(409, "Checkout is no longer open. Retry to reconcile its status.");
    return NextResponse.json({ url: canonical.url });
  } catch (error) {
    const result = publicApiError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
