import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { integrationDestination } from "../lib/integrations";
import { deliverIntegration, leadIntegrationPayload } from "../lib/server/integrations";
import { authorizedWorker } from "../lib/server/cron";
import { POST } from "../app/api/internal/integrations/route";
import { testDatabase } from "./helpers/database";
import { plans, paidPlanIds } from "../lib/plans";
const hook = "https://hooks.zapier.com/hooks/catch/12345/sample-token/";

test("integration destinations reject internal hosts, credentials, lookalikes and query forwarding", () => {
  assert.equal(integrationDestination(hook).provider, "zapier");
  for (const zone of ["eu1", "eu2", "us1", "us2"])
    assert.equal(
      integrationDestination(`https://hook.${zone}.make.com/${"a".repeat(32)}`).provider,
      "make",
    );
  for (const url of [
    "http://hooks.zapier.com/hooks/catch/1/a",
    "https://127.0.0.1/",
    "https://localhost/",
    "https://hooks.zapier.com.attacker.test/hooks/catch/1/a",
    "https://attacker.test@hooks.zapier.com/hooks/catch/1/a",
    "https://hooks.zapier.com:8443/hooks/catch/1/a",
    `${hook}?target=localhost`,
    `${hook}#token`,
    "https://hook.eu1.make.com.evil.test/a",
    "https://hook.eu1.make.com/short",
    "https://hooks.zapier.com/../internal",
  ])
    assert.throws(() => integrationDestination(url));
});

test("webhook payloads exclude access tokens and private pricing details and never follow redirects", async (t) => {
  const payload = leadIntegrationPayload(
    "event-1",
    {
      id: "lead-1",
      created_at: "2026-01-01T00:00:00Z",
      lead_name: "Customer",
      lead_email: "sample@example.test",
      lead_phone: null,
      answers: { area: 40 },
      quote: {
        low: 100,
        high: 120,
        currency: "EUR",
        subtotal: 110,
        breakdown: [{ label: "private", amount: 110 }],
        access_token_hash: "private",
      },
    },
    { public_id: "painting-123", name: "Painting" },
  );
  assert.deepEqual(payload.estimate, { low: 100, high: 120, currency: "EUR" });
  assert.equal(JSON.stringify(payload).includes("private"), false);
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    assert.equal(options.redirect, "error");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(String(options.body)), payload);
    return new Response(null, { status: 429 });
  });
  assert.deepEqual(await deliverIntegration(hook, payload), { ok: false, status: 429 });
  await assert.rejects(() => deliverIntegration("https://localhost/", payload));
});

test("scheduled endpoints require the configured bearer secret", async () => {
  const original = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "test-worker-secret";
    assert.equal(
      authorizedWorker(
        new Request("https://example.test", {
          headers: { authorization: "Bearer test-worker-secret" },
        }),
      ),
      true,
    );
    assert.equal((await POST(new Request("https://example.test"))).status, 401);
    assert.equal(
      (
        await POST(
          new Request("https://example.test", { headers: { authorization: "Bearer wrong" } }),
        )
      ).status,
      401,
    );
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  }
});

test("paid calculator limits and enquiry allowances match database enforcement", async () => {
  const db = await testDatabase();
  try {
    const user = "11111111-1111-4111-8111-111111111111";
    await db.query("insert into auth.users values ($1,'owner@example.test')", [user]);
    const org = (
      await db.query<{ id: string }>(
        "select public.get_or_create_default_organization($1,'Limits') as id",
        [user],
      )
    ).rows[0].id;
    await db.query("update public.organizations set stripe_customer_id='cus_limits' where id=$1", [
      org,
    ]);
    for (const plan of paidPlanIds) {
      await db.query("update public.calculators set archived_at=now() where organization_id=$1", [
        org,
      ]);
      await db.query(
        "insert into public.billing_subscriptions(organization_id,stripe_customer_id,stripe_subscription_id,plan,status,current_period_end) values($1,'cus_limits','sub_limits',$2,'active',now()+interval '30 days') on conflict(organization_id) do update set plan=excluded.plan",
        [org, plan],
      );
      let calc = "";
      for (let i = 0; i < plans[plan].calculators; i++)
        calc = (
          await db.query<{ id: string }>(
            "select public.create_calculator_with_version($1,$2,$2,'painting','{}','[]') as id",
            [org, `${plan}-${i}`],
          )
        ).rows[0].id;
      await assert.rejects(
        () =>
          db.query("select public.create_calculator_with_version($1,$2,$2,'painting','{}','[]')", [
            org,
            `${plan}-extra`,
          ]),
        /Calculator limit/,
      );
      await db.query(
        "insert into public.workspace_usage values($1,date_trunc('month',now() at time zone 'UTC')::date,$2) on conflict(organization_id,month) do update set leads=excluded.leads",
        [org, plans[plan].monthlyLeads - 1],
      );
      const capture = () =>
        db.query(
          "select public.capture_submission($1,'painting','{}','{}','Client','sample@example.test',null,$2,false)",
          [calc, randomBytes(32).toString("hex")],
        );
      await capture();
      await assert.rejects(capture, /Monthly lead limit/);
    }
  } finally {
    await db.close();
  }
});

test("integration outbox is atomic, private, leased, bounded and cancels when settings change", async () => {
  const db = await testDatabase();
  try {
    const user = "11111111-1111-4111-8111-111111111111";
    await db.query("insert into auth.users values ($1,'owner@example.test')", [user]);
    const org = (
      await db.query<{ id: string }>(
        "select public.get_or_create_default_organization($1,'Hooks') as id",
        [user],
      )
    ).rows[0].id;
    const calc = (
      await db.query<{ id: string }>(
        "select public.create_calculator_with_version($1,'painting-hook','Painting','painting','{}','[]') as id",
        [org],
      )
    ).rows[0].id;
    const configure = (enabled: boolean, url = hook) =>
      db.query("select public.configure_workspace_integration($1,'zapier',$2,$3)", [
        org,
        url,
        enabled,
      ]);
    const capture = () =>
      db.query(
        "select public.capture_submission($1,'painting','{}','{}','Client','sample@example.test',null,$2,false)",
        [calc, randomBytes(32).toString("hex")],
      );
    await assert.rejects(() => configure(true), /Upgrade/);
    await capture();
    await db.query(
      "insert into public.billing_subscriptions(organization_id,stripe_customer_id,stripe_subscription_id,plan,status,current_period_end) values($1,'cus_hook','sub_hook','premium','active',now()+interval '30 days')",
      [org],
    );
    await assert.rejects(() => configure(true, "https://localhost/"), /Invalid integration/);
    await configure(true);
    assert.equal((await db.query("select * from public.integration_deliveries")).rows.length, 0);
    await capture();
    const claim = async () =>
      (
        await db.query<{ rows: { id: string; claim_token: string; attempts: number }[] }>(
          "select public.claim_integration_deliveries(1) as rows",
        )
      ).rows[0].rows;
    const first = await claim();
    assert.equal(first.length, 1);
    assert.equal(first[0].attempts, 1);
    assert.deepEqual(await claim(), []);
    await db.query(
      "update public.integration_deliveries set next_attempt_at=now()-interval '1 second'",
    );
    const second = await claim();
    assert.equal(second[0].attempts, 2);
    assert.notEqual(second[0].claim_token, first[0].claim_token);
    const stale = await db.query(
      "update public.integration_deliveries set status='delivered' where id=$1 and claim_token=$2 returning id",
      [first[0].id, first[0].claim_token],
    );
    assert.equal(stale.rows.length, 0);
    await configure(false);
    assert.deepEqual(await claim(), []);
    assert.equal(
      (await db.query<{ status: string }>("select status from public.integration_deliveries"))
        .rows[0].status,
      "cancelled",
    );
    await configure(true);
    await capture();
    await db.query(
      "update public.integration_deliveries set attempts=5,next_attempt_at=now()-interval '1 second' where status='pending'",
    );
    assert.deepEqual(await claim(), []);
    assert.equal(
      (await db.query("select * from public.integration_deliveries where status='failed'")).rows
        .length,
      1,
    );
    await db.query("update public.billing_subscriptions set status='canceled'");
    await capture();
    assert.equal((await db.query("select * from public.integration_deliveries")).rows.length, 2);
    await db.exec(
      "grant usage on schema public to authenticated; grant select on all tables in schema public to authenticated; set role authenticated",
    );
    assert.equal((await db.query("select * from public.workspace_integrations")).rows.length, 0);
    assert.equal((await db.query("select * from public.integration_deliveries")).rows.length, 0);
    await assert.rejects(() => configure(true), /permission denied/);
    await assert.rejects(() => claim(), /permission denied/);
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});

test("delivery worker handles acceptance, retries, downgrades and changed destinations", async (t) => {
  const variables = {
    NEXT_PUBLIC_SUPABASE_URL: "https://database.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  };
  const previous = Object.fromEntries(Object.keys(variables).map((key) => [key, process.env[key]]));
  Object.assign(process.env, variables);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const { sendLeadIntegrations } = await import("../lib/server/integrations");
  let scenario = "accepted",
    claimed = false,
    requests = 0;
  const updates: Record<string, unknown>[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      );
      if (url.hostname === "hooks.zapier.com") {
        requests++;
        return new Response(null, { status: scenario === "retry" ? 429 : 200 });
      }
      if (url.pathname.endsWith("/claim_integration_deliveries")) {
        const row = claimed
          ? []
          : [
              {
                id: "event-1",
                organization_id: "org",
                submission_id: "lead",
                revision: "v1",
                claim_token: "lease",
                attempts: scenario === "exhausted" ? 5 : 1,
              },
            ];
        claimed = true;
        return Response.json(row);
      }
      if (url.pathname.endsWith("/workspace_integrations"))
        return Response.json([
          { endpoint_url: hook, enabled: true, revision: scenario === "changed" ? "v2" : "v1" },
        ]);
      if (url.pathname.endsWith("/submissions"))
        return Response.json([
          {
            id: "lead",
            calculator_id: "calculator",
            created_at: new Date().toISOString(),
            lead_name: "Sample",
            lead_email: "sample@example.test",
            lead_phone: null,
            answers: { area: 50 },
            quote: { low: 100, high: 120, currency: "EUR" },
          },
        ]);
      if (url.pathname.endsWith("/organizations"))
        return Response.json({
          id: "org",
          name: "Example",
          trial_ends_at: "2020-01-01",
          stripe_account_id: null,
        });
      if (url.pathname.endsWith("/billing_subscriptions"))
        return Response.json(
          scenario === "downgraded"
            ? []
            : [
                {
                  plan: "premium",
                  status: "active",
                  current_period_end: new Date(Date.now() + 86400000).toISOString(),
                },
              ],
        );
      if (url.pathname.endsWith("/calculators"))
        return Response.json({ public_id: "painting-123", name: "Painting" });
      if (url.pathname.endsWith("/integration_deliveries")) {
        assert.equal(url.searchParams.get("claim_token"), "eq.lease");
        updates.push(JSON.parse(String(options?.body)));
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected path ${url.pathname}`);
    },
  );
  for (const state of ["accepted", "retry", "downgraded", "changed", "exhausted"]) {
    scenario = state;
    claimed = false;
    requests = 0;
    updates.length = 0;
    const result = await sendLeadIntegrations();
    assert.equal(updates.length, 1);
    if (["downgraded", "changed"].includes(state)) {
      assert.equal(requests, 0);
      assert.equal(updates[0].status, "cancelled");
      assert.equal(result.cancelled, 1);
    } else if (state === "accepted" || state === "exhausted") {
      assert.equal(requests, 1);
      assert.equal(updates[0].status, "delivered");
      assert.equal(result.delivered, 1);
    } else {
      assert.equal(requests, 1);
      assert.equal(updates[0].status, "pending");
      assert.equal(result.failed, 1);
      assert.equal(updates[0].last_status, 429);
    }
  }
});
