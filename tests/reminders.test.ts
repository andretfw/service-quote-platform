import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { testDatabase } from "./helpers/database";
import { customerReminderMessage } from "../lib/server/reminder-message";
import { sendCustomerReminders } from "../lib/server/reminders";

const id = "11111111-1111-4111-8111-111111111111";

test("customer reminders name the business, show the estimate and route replies safely in all languages", () => {
  for (const locale of ["en", "es", "ro"] as const) {
    const message = customerReminderMessage(
      {
        name: "<script>Client</script>",
        business: "Painting\r\nStudio",
        calculator: "<img src=x>",
        estimate: "€100–€120",
        replyTo: "owner@example.test",
      },
      "https://app.example.test/unsubscribe?token=test",
      locale,
    );
    assert.equal(message.reply_to, "owner@example.test");
    assert.ok(message.subject.startsWith("Painting  Studio:"));
    assert.equal(/[\r\n]/.test(message.subject), false);
    assert.equal(message.html.includes("<script>"), false);
    assert.equal(message.html.includes("<img src=x>"), false);
    assert.ok(message.html.includes("mailto:owner%40example.test"));
    assert.ok(message.text.includes("€100–€120"));
    assert.equal(message.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
    assert.ok(message.headers["List-Unsubscribe"].includes("/api/public/unsubscribe?token=test"));
  }
});

test("reminder claims skip ineligible leads, serialize workers and reject stale leases", async () => {
  const db = await testDatabase();
  try {
    await db.query("insert into auth.users values ($1,'owner@example.test')", [id]);
    const org = (
      await db.query<{ id: string }>(
        "select public.get_or_create_default_organization($1,'Studio') as id",
        [id],
      )
    ).rows[0].id;
    await db.query("update public.organizations set stripe_customer_id='cus_test' where id=$1", [
      org,
    ]);
    await db.query(
      "select public.sync_billing_subscription($1,'cus_test','sub_test','premium','active',now()+interval '30 days',false,now())",
      [org],
    );
    const calculator = (
      await db.query<{ id: string }>(
        'select public.create_calculator_with_version($1,\'saved\',\'Painting estimate\',\'painting\',\'{"settings":{"followUps":true,"businessName":"Painting Studio","locale":"ro"}}\',\'[]\') as id',
        [org],
      )
    ).rows[0].id;
    const capture = async (consent = true) =>
      (
        await db.query<{ id: string }>(
          "select public.capture_submission($1,'painting','{}','{\"low\":100,\"high\":120,\"currency\":\"EUR\"}','Client','client@example.test',null,$2,$3) as id",
          [calculator, randomBytes(32).toString("hex"), consent],
        )
      ).rows[0].id;
    const due = async (lead: string) =>
      db.query(
        "update public.submissions set next_follow_up_at=now()-interval '1 day' where id=$1",
        [lead],
      );
    const claim = async () =>
      (
        await db.query<{
          result: { id: string; claim_token: string; reply_to: string; business_name: string }[];
        }>("select public.claim_customer_reminders(1) as result")
      ).rows[0].result;
    const finish = async (lead: string, token: string, sent = true) =>
      (
        await db.query<{ finished: boolean }>(
          "select public.finish_customer_reminder($1,$2,$3) as finished",
          [lead, token, sent],
        )
      ).rows[0].finished;
    const noConsent = await capture(false);
    await due(noConsent);
    const exhausted = await capture();
    await due(exhausted);
    await db.query("update public.submissions set follow_up_count=3 where id=$1", [exhausted]);
    const eligible = await capture();
    await due(eligible);
    const results = await Promise.all([claim(), claim()]);
    assert.equal(results.flat().length, 1);
    const first = results.flat()[0];
    assert.equal(first.id, eligible);
    assert.equal(first.reply_to, "owner@example.test");
    assert.equal(first.business_name, "Painting Studio");
    assert.deepEqual(await claim(), []);
    await due(eligible);
    const second = (await claim())[0];
    assert.notEqual(first.claim_token, second.claim_token);
    assert.equal(await finish(eligible, first.claim_token), false);
    assert.equal(await finish(eligible, second.claim_token, false), true);
    const afterFailure = (
      await db.query<{ follow_up_count: number; delay: number }>(
        "select follow_up_count,extract(epoch from next_follow_up_at-now()) as delay from public.submissions where id=$1",
        [eligible],
      )
    ).rows[0];
    assert.equal(afterFailure.follow_up_count, 0);
    assert.ok(Number(afterFailure.delay) > 3500);
    for (let count = 0; count < 3; count++) {
      await due(eligible);
      const row = (await claim())[0];
      assert.equal(await finish(eligible, row.claim_token), true);
      assert.equal(await finish(eligible, row.claim_token), false);
    }
    assert.equal(
      (
        await db.query<{ next_follow_up_at: string | null }>(
          "select next_follow_up_at from public.submissions where id=$1",
          [eligible],
        )
      ).rows[0].next_follow_up_at,
      null,
    );
    const unsubscribed = await capture();
    await due(unsubscribed);
    const unsubClaim = (await claim())[0];
    await db.query(
      "update public.submissions set follow_up_consent=false,next_follow_up_at=null where id=$1",
      [unsubscribed],
    );
    assert.equal(await finish(unsubscribed, unsubClaim.claim_token), false);
    const closed = await capture();
    await due(closed);
    const closedClaim = (await claim())[0];
    await db.query("select public.set_lead_status($1,$2,'lost')", [org, closed]);
    assert.equal(await finish(closed, closedClaim.claim_token), false);
    await db.query(
      "update public.billing_subscriptions set plan='business' where organization_id=$1",
      [org],
    );
    await db.query("update public.calculator_versions set schema=$2 where calculator_id=$1", [
      calculator,
      JSON.stringify({ settings: { followUps: true, bookingRequests: true } }),
    ]);
    const requested = await capture();
    await due(requested);
    const bookingClaim = (await claim())[0];
    await db.query("select public.request_booking($1,now()+interval '2 days')", [requested]);
    assert.equal(await finish(requested, bookingClaim.claim_token), false);
    assert.equal(
      (
        await db.query<{ next_follow_up_at: string | null }>(
          "select next_follow_up_at from public.submissions where id=$1",
          [requested],
        )
      ).rows[0].next_follow_up_at,
      null,
    );
    await due(requested);
    assert.deepEqual(await claim(), []);
    const paused = await capture();
    await due(paused);
    await db.query(
      'update public.calculator_versions set schema=\'{"settings":{"followUps":false}}\' where calculator_id=$1',
      [calculator],
    );
    assert.deepEqual(await claim(), []);
    await db.query(
      'update public.calculator_versions set schema=\'{"settings":{"followUps":true}}\' where calculator_id=$1',
      [calculator],
    );
    await db.query("update public.calculators set archived_at=now() where id=$1", [calculator]);
    assert.deepEqual(await claim(), []);
    await db.query("update public.calculators set archived_at=null where id=$1", [calculator]);
    await db.query(
      "update public.billing_subscriptions set status='canceled' where organization_id=$1",
      [org],
    );
    assert.deepEqual(await claim(), []);
    await db.exec("grant usage on schema public to authenticated; set role authenticated");
    await assert.rejects(claim, /permission denied/);
    await assert.rejects(() => finish(paused, first.claim_token), /permission denied/);
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});

test("reminder worker handles provider rejection, consent changes and accepted messages without advancing unsent work", async (t) => {
  const variables = {
    NEXT_PUBLIC_SUPABASE_URL: "https://database.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "test-service",
    NEXT_PUBLIC_APP_URL: "https://app.example.test",
    EMAIL_PROVIDER: "resend",
    UNSUBSCRIBE_SECRET: "u".repeat(32),
  };
  const previous = Object.fromEntries(Object.keys(variables).map((key) => [key, process.env[key]]));
  Object.assign(process.env, variables);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  let scenario = "accepted",
    claimed = false;
  const payloads: Record<string, unknown>[] = [],
    completions: boolean[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.pathname.endsWith("/claim_customer_reminders")) {
      const data = claimed
        ? []
        : [
            {
              id,
              claim_token: id,
              follow_up_count: 0,
              lead_name: "Client",
              lead_email: "client@example.test",
              quote: { locale: "ro", low: 100, high: 120, currency: "EUR" },
              business_name: "Studio",
              calculator_name: "Painting",
              reply_to: "owner@example.test",
              locale: "en",
            },
          ];
      claimed = true;
      return Response.json(data);
    }
    if (url.pathname.endsWith("/submissions")) {
      assert.equal(url.searchParams.get("follow_up_claim_token"), `eq.${id}`);
      return Response.json(scenario === "unsubscribed" ? [] : [{ id }]);
    }
    if (url.hostname === "api.resend.com") {
      payloads.push(JSON.parse(String(init?.body)));
      return Response.json({ id: "email" }, { status: scenario === "rejected" ? 429 : 200 });
    }
    if (url.pathname.endsWith("/finish_customer_reminder")) {
      const body = JSON.parse(String(init?.body));
      completions.push(body.p_sent);
      return scenario === "db-failed"
        ? Response.json({ message: "test failure", code: "XX000" }, { status: 500 })
        : Response.json(true);
    }
    throw new Error(`Unexpected path ${url.pathname}`);
  });
  for (const state of ["accepted", "rejected", "unsubscribed", "db-failed"]) {
    scenario = state;
    claimed = false;
    payloads.length = 0;
    completions.length = 0;
    const result = await sendCustomerReminders(
      "test",
      "Service <sender@example.test>",
      Date.now() + 18000,
    );
    if (state === "unsubscribed") {
      assert.equal(payloads.length, 0);
      assert.equal(result.skipped, 1);
      assert.deepEqual(completions, []);
    } else {
      assert.equal(payloads.length, 1);
      assert.equal(payloads[0].reply_to, "owner@example.test");
      assert.match(String(payloads[0].subject), /Studio: Te mai interesează/);
      assert.deepEqual(completions, [state !== "rejected"]);
      assert.equal(result.sent, state === "accepted" ? 1 : 0);
      assert.equal(result.failed, state === "accepted" ? 0 : 1);
    }
  }
  delete process.env.UNSUBSCRIBE_SECRET;
  claimed = false;
  assert.deepEqual(await sendCustomerReminders("test", "sender", Date.now() + 18000), {
    sent: 0,
    failed: 0,
    skipped: 0,
  });
  assert.equal(claimed, false);
});
