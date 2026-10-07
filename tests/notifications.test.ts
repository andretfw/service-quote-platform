import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types";
import { workspaceLead } from "../lib/server/lead-details";
import { getTemplate } from "../lib/templates";
import { answerSummary, formatEstimate } from "../lib/lead-summary";
import { leadNotificationMessage } from "../lib/server/notification-message";
import { attemptLeadNotification, sendLeadNotifications } from "../lib/server/notifications";

const leadId = "11111111-1111-4111-8111-111111111111";
const notificationId = "22222222-2222-4222-8222-222222222222";

test("email and lead summaries show option labels, omit hidden stale answers and escape customer content", () => {
  const painting = getTemplate("painting")!;
  const answers = answerSummary(painting.questions, {
    scope: "interior",
    area: 1000,
    exterior_area: 9000,
    extras: ["doors"],
    doors_quantity: 3,
    notes: '<img src=x onerror="alert(1)">',
  });
  assert.ok(answers.some((row) => row.value === "Interior"));
  assert.ok(answers.some((row) => row.label === "Number of door faces" && row.value === "3"));
  assert.equal(
    answers.some((row) => row.label.includes("Exterior")),
    false,
  );
  const message = leadNotificationMessage(
    {
      id: leadId,
      name: "<script>bad</script>",
      email: "client@example.test",
      phone: "+123",
      calculatorName: "Painting",
      estimate: "$100–$200",
      answers,
    },
    "https://service.example.test",
  );
  assert.equal(message.reply_to, "client@example.test");
  assert.ok(message.html.includes("&lt;script&gt;"));
  assert.equal(message.html.includes("<script>"), false);
  assert.equal(message.html.includes("<img src=x"), false);
  assert.ok(message.text.includes(`/leads/${leadId}`));
  assert.equal(formatEstimate({ low: NaN, high: 100, currency: "USD" }), "Estimate unavailable");
  assert.equal(formatEstimate({ low: 100, high: 200, currency: "USD" }), "$100.00–$200.00");
});

function emailMock(t: TestContext, providerStatus = 200) {
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_APP_URL",
    "RESEND_API_KEY",
    "RESEND_FROM",
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://database.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    NEXT_PUBLIC_APP_URL: "https://service.example.test",
    RESEND_API_KEY: "test-email-key",
    RESEND_FROM: "Service Quote <alerts@example.test>",
  });
  t.after(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });
  let retryAt = new Date(0).toISOString();
  let sentAt: string | null = null;
  const payloads: Record<string, unknown>[] = [];
  const keys: string[] = [];
  const template = structuredClone(getTemplate("painting")!);
  const { rules, ...schema } = template;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    const method = init?.method ?? "GET";
    const json = (value: unknown) => Response.json(value);
    if (url.hostname === "api.resend.com") {
      payloads.push(JSON.parse(String(init?.body)));
      keys.push(new Headers(init?.headers).get("idempotency-key")!);
      return new Response(
        JSON.stringify(
          providerStatus === 200 ? { id: "provider-id" } : { error: "test rejection" },
        ),
        { status: providerStatus, headers: { "content-type": "application/json" } },
      );
    }
    if (url.pathname.endsWith("/notification_outbox")) {
      if (method === "GET")
        return json(
          sentAt || Date.parse(retryAt) > Date.now()
            ? []
            : [{ id: notificationId, submission_id: leadId, recipient: "owner@example.test" }],
        );
      const patch = JSON.parse(String(init?.body));
      if (patch.sent_at) {
        sentAt = patch.sent_at;
        return new Response(null, { status: 204 });
      }
      const cutoff = url.searchParams.get("retry_at")?.replace("lte.", "") ?? "";
      if (sentAt || Date.parse(retryAt) > Date.parse(cutoff)) return json(null);
      retryAt = patch.retry_at;
      return json({ id: notificationId });
    }
    if (url.pathname.endsWith("/submissions"))
      return json([
        {
          id: leadId,
          calculator_id: "calculator",
          template_slug: "painting",
          lead_name: "Client",
          lead_email: "client@example.test",
          lead_phone: null,
          answers: { scope: "interior", area: 100 },
          quote: { low: 100, high: 200, currency: "USD" },
          created_at: new Date().toISOString(),
        },
      ]);
    if (url.pathname.endsWith("/calculator_versions"))
      return json([{ schema, pricing_rules: rules }]);
    throw new Error(`Unexpected request ${url.pathname}`);
  });
  return { payloads, keys, sentAt: () => sentAt };
}

test("concurrent workers send the owner one alert and preserve the customer's reply address", async (t) => {
  const state = emailMock(t);
  const results = await Promise.all([
    sendLeadNotifications("key", "alerts@example.test", Date.now() + 5000, leadId),
    sendLeadNotifications("key", "alerts@example.test", Date.now() + 5000, leadId),
  ]);
  assert.equal(
    results.reduce((sum, value) => sum + value.sent, 0),
    1,
  );
  assert.equal(state.payloads.length, 1);
  assert.equal(state.payloads[0].to, "owner@example.test");
  assert.equal(state.payloads[0].reply_to, "client@example.test");
  assert.equal(state.keys[0], `lead-notification/${notificationId}`);
  assert.ok(state.sentAt());
  assert.equal(
    (await sendLeadNotifications("key", "alerts@example.test", Date.now() + 5000, leadId)).sent,
    0,
  );
});

test("provider failure leaves the alert queued and never fails the enquiry notification attempt", async (t) => {
  const state = emailMock(t, 403);
  const result = await attemptLeadNotification(leadId);
  assert.deepEqual(result, { sent: 0, failed: 1 });
  assert.equal(state.sentAt(), null);
  assert.equal(state.payloads.length, 1);
});

test("missing email configuration skips sending without losing the enquiry", async (t) => {
  const previous = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  t.after(() => {
    if (previous !== undefined) process.env.RESEND_API_KEY = previous;
  });
  const fetchMock = t.mock.method(globalThis, "fetch", () => {
    throw new Error("Should not send");
  });
  assert.deepEqual(await attemptLeadNotification(leadId), { sent: 0, failed: 0 });
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("enquiry details reject leads from another business workspace", async (t) => {
  const db = createClient<Database>("https://database.example.test", "test-key", {
    auth: { persistSession: false },
  });
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.pathname.endsWith("/submissions"))
      return Response.json([{ id: leadId, calculator_id: "calculator" }]);
    if (url.pathname.endsWith("/calculators"))
      return Response.json(
        url.searchParams.get("organization_id") === "eq.owner" ? [{ id: "calculator" }] : [],
      );
    throw new Error("Unexpected database query");
  });
  const owner = { db, organizationId: "owner" } as Parameters<typeof workspaceLead>[0];
  const outsider = { db, organizationId: "outsider" } as Parameters<typeof workspaceLead>[0];
  assert.equal((await workspaceLead(owner, leadId))?.id, leadId);
  assert.equal(await workspaceLead(outsider, leadId), null);
});
