import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { plans, paidPlanIds } from "../lib/plans";
import { assertSubscriptionPrice, priceId, billingConfigured } from "../lib/server/billing";
import { POST } from "../app/api/billing/checkout/route";

test("checkout requires every Stripe variable and Free never requires payment", async () => {
  const values: Record<string, string | undefined> = {
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_BILLING_WEBHOOK_SECRET: "whsec_placeholder",
    STRIPE_PRICE_BASIC: "price_basic",
    STRIPE_PRICE_PREMIUM: "price_premium",
    STRIPE_PRICE_BUSINESS: "price_business",
    NEXT_PUBLIC_SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
  };
  const original = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  try {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    assert.equal(billingConfigured(), true);
    assert.throws(() => priceId("free" as never), /Free does not require payment/);
    for (const name of Object.keys(values).filter((name) => name.startsWith("STRIPE_"))) {
      process.env[name] = " ";
      assert.equal(billingConfigured(), false);
      process.env[name] = values[name];
    }
    delete process.env.STRIPE_PRICE_BUSINESS;
    const response = await POST(
      new Request("https://example.netlify.app/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://example.netlify.app" },
        body: JSON.stringify({ plan: "basic" }),
      }),
    );
    assert.equal(response.status, 503);
  } finally {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("Stripe prices must match the published amount and monthly licensed billing", () => {
  for (const plan of paidPlanIds) {
    const price = {
      active: true,
      currency: "eur",
      unit_amount: plans[plan].monthlyEur * 100,
      billing_scheme: "per_unit",
      recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
    } as Stripe.Price;
    assert.doesNotThrow(() => assertSubscriptionPrice(price, plan));
    for (const patch of [
      { active: false },
      { currency: "usd" },
      { unit_amount: null },
      { unit_amount: price.unit_amount! + 100 },
      { billing_scheme: "tiered" },
      { recurring: null },
      { recurring: { ...price.recurring, interval: "year" } },
      { recurring: { ...price.recurring, interval_count: 2 } },
      { recurring: { ...price.recurring, usage_type: "metered" } },
    ])
      assert.throws(
        () => assertSubscriptionPrice({ ...price, ...patch } as Stripe.Price, plan),
        /Subscription price does not match/,
      );
  }
});
