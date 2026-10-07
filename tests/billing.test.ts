import assert from "node:assert/strict";
import test from "node:test";
import { billingConfigured } from "../lib/server/billing";
import { POST } from "../app/api/billing/checkout/route";

test("unapproved pricing blocks checkout even when Stripe variables are present", async () => {
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
    assert.equal(billingConfigured(), false);
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
