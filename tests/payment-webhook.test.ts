import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { POST } from "../app/api/stripe/webhook/route";

const submissionId = "11111111-1111-4111-8111-111111111111";

test("deposit webhook validates signature, business account, reference, amount and currency before marking paid", async (t) => {
  const variables = {
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_test_placeholder",
    STRIPE_WEBHOOK_SECRET: "",
    NEXT_PUBLIC_SUPABASE_URL: "https://database.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "test-service",
  };
  const previous = Object.fromEntries(
    Object.keys(variables).map((name) => [name, process.env[name]]),
  );
  Object.assign(process.env, variables);
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  let status = "pending",
    updates = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    assert.ok(url.pathname.endsWith("/payments"));
    if (init?.method === "PATCH") {
      const body = JSON.parse(String(init.body));
      status = body.status;
      updates++;
      return new Response(null, { status: 204 });
    }
    return Response.json([
      {
        id: "payment-id",
        submission_id: submissionId,
        amount_cents: 2000,
        currency: "eur",
        status,
        stripe_account_id: "acct_business",
      },
    ]);
  });
  const request = async (
    patch: Record<string, unknown> = {},
    account: string | null = "acct_business",
    type = "checkout.session.completed",
    signed = true,
  ) => {
    const payload = JSON.stringify({
      id: "evt_test",
      object: "event",
      type,
      ...(account ? { account } : {}),
      data: {
        object: {
          id: "cs_test",
          client_reference_id: submissionId,
          amount_total: 2000,
          currency: "eur",
          payment_status: "paid",
          ...patch,
        },
      },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: signed ? variables.STRIPE_CONNECT_WEBHOOK_SECRET : "wrong-secret",
    });
    return POST(
      new Request("https://app.example.test/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": signature },
        body: payload,
      }),
    );
  };
  assert.equal(
    (await request({}, "acct_business", "checkout.session.completed", false)).status,
    400,
  );
  for (const patch of [
    { amount_total: 1999 },
    { currency: "usd" },
    { client_reference_id: "other" },
    { payment_status: "unpaid" },
  ])
    assert.equal((await request(patch)).status, 400);
  assert.equal((await request({}, "acct_other")).status, 400);
  assert.equal((await request({}, null)).status, 400);
  assert.equal(updates, 0);
  assert.equal((await request()).status, 200);
  assert.equal(status, "paid");
  assert.equal((await request({}, "acct_business", "checkout.session.expired")).status, 200);
  assert.equal(status, "paid");
  assert.equal(updates, 1);
});
