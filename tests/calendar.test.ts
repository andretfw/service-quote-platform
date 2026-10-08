import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { testDatabase } from "./helpers/database";
import { dateInZone, overlaps, validTimezone } from "../lib/calendar";
import {
  encryptCalendarSecret,
  decryptCalendarSecret,
  calendarChallenge,
} from "../lib/server/calendar-security";
import {
  calendarAuthorization,
  providerBusy,
  writeCalendarBooking,
} from "../lib/server/calendar-provider";
test("calendar dates honor time zones and daylight saving; adjacent slots do not conflict", () => {
  assert.equal(dateInZone("2026-10-24T22:30:00Z", "Europe/Bucharest"), "2026-10-25");
  assert.equal(dateInZone("2026-01-01T01:00:00Z", "America/New_York"), "2025-12-31");
  assert.equal(validTimezone("not-a-zone"), false);
  assert.equal(
    overlaps("2026-10-01T10:00Z", "2026-10-01T11:00Z", [
      { start: "2026-10-01T11:00Z", end: "2026-10-01T12:00Z" },
    ]),
    false,
  );
});
test("calendar credentials are authenticated, tenant-bound and OAuth uses PKCE", () => {
  const previous = { ...process.env };
  Object.assign(process.env, {
    CALENDAR_ENCRYPTION_KEY: "a".repeat(64),
    GOOGLE_CALENDAR_CLIENT_ID: "google-test",
    GOOGLE_CALENDAR_CLIENT_SECRET: "test",
    MICROSOFT_CALENDAR_CLIENT_ID: "outlook-test",
    MICROSOFT_CALENDAR_CLIENT_SECRET: "test",
    NEXT_PUBLIC_APP_URL: "https://app.example.test",
  });
  try {
    const encrypted = encryptCalendarSecret("private-refresh-token", "org/google");
    assert.equal(encrypted.includes("private-refresh-token"), false);
    assert.equal(decryptCalendarSecret(encrypted, "org/google"), "private-refresh-token");
    assert.throws(() => decryptCalendarSecret(encrypted, "other/google"));
    const changed = Buffer.from(encrypted, "base64url");
    changed[30] ^= 1;
    assert.throws(() => decryptCalendarSecret(changed.toString("base64url"), "org/google"));
    for (const provider of ["google", "outlook"] as const) {
      const url = new URL(calendarAuthorization(provider, "state", "v".repeat(43)));
      assert.equal(url.searchParams.get("code_challenge"), calendarChallenge("v".repeat(43)));
      assert.equal(url.searchParams.get("code_challenge_method"), "S256");
      assert.equal(url.searchParams.get("state"), "state");
      assert.equal(
        url.searchParams.get("redirect_uri"),
        `https://app.example.test/api/calendar/${provider}/callback`,
      );
    }
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in previous)) delete process.env[name];
    Object.assign(process.env, previous);
  }
});
test("database calendar prevents double confirmation, checks hours/blocks, isolates workspaces and queues changes", async () => {
  const db = await testDatabase();
  try {
    const user = "11111111-1111-4111-8111-111111111111",
      otherUser = "22222222-2222-4222-8222-222222222222";
    await db.query(
      "insert into auth.users values ($1,'owner@example.test'),($2,'other@example.test')",
      [user, otherUser],
    );
    const org = (
      await db.query<{ id: string }>(
        "select public.get_or_create_default_organization($1,'Studio') id",
        [user],
      )
    ).rows[0].id;
    const other = (
      await db.query<{ id: string }>(
        "select public.get_or_create_default_organization($1,'Other') id",
        [otherUser],
      )
    ).rows[0].id;
    await db.query(
      "update public.organizations set stripe_customer_id='cus_calendar' where id=$1",
      [org],
    );
    await db.query(
      "select public.sync_billing_subscription($1,'cus_calendar','sub_calendar','business','active',now()+interval '30 days',false,now())",
      [org],
    );
    const calculator = (
      await db.query<{ id: string }>(
        "select public.create_calculator_with_version($1,'calendar','Service','painting','{\"settings\":{\"bookingRequests\":true}}','[]') id",
        [org],
      )
    ).rows[0].id;
    const capture = async () =>
      (
        await db.query<{ id: string }>(
          "select public.capture_submission($1,'painting','{}','{}','Customer','customer@example.test',null,$2,false) id",
          [calculator, randomBytes(32).toString("hex")],
        )
      ).rows[0].id;
    const monday = new Date();
    monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7 || 7));
    monday.setUTCHours(10, 0, 0, 0);
    const start = monday.toISOString(),
      end = new Date(monday.getTime() + 3600000).toISOString();
    await db.query(
      "insert into public.booking_settings(organization_id,timezone,enforce_hours) values($1,'UTC',true)",
      [org],
    );
    await db.query(
      "insert into public.calendar_connections(organization_id,provider,refresh_token) values($1,'google','encrypted'),($1,'outlook','encrypted')",
      [org],
    );
    const request = async () =>
      (
        await db.query<{ id: string }>("select public.request_booking($1,$2) id", [
          await capture(),
          start,
        ])
      ).rows[0].id;
    const a = await request(),
      b = await request();
    await db.query("select public.resolve_booking($1,$2,'confirmed')", [org, a]);
    await assert.rejects(
      () => db.query("select public.resolve_booking($1,$2,'confirmed')", [org, b]),
      /unavailable/,
    );
    await assert.rejects(
      () => db.query("select public.resolve_booking($1,$2,'confirmed')", [other, a]),
      /not found/,
    );
    assert.equal((await db.query("select * from public.calendar_deliveries")).rows.length, 2);
    await assert.rejects(
      () => db.query("select public.create_calendar_block($1,$2,$3,'Lunch')", [org, start, end]),
      /overlaps/,
    );
    await db.query("select public.resolve_booking($1,$2,'cancelled')", [org, a]);
    await db.query("select public.resolve_booking($1,$2,'confirmed')", [org, b]);
    const claimed = (
      await db.query<{ data: { claim_token: string }[] }>(
        "select public.claim_calendar_deliveries(10) data",
      )
    ).rows[0].data;
    assert.equal(claimed.length, 4);
    assert.equal(
      (await db.query<{ data: unknown[] }>("select public.claim_calendar_deliveries(10) data"))
        .rows[0].data.length,
      0,
    );
    await db.query("select public.reschedule_booking($1,$2,$3,$4)", [
      org,
      b,
      end,
      new Date(monday.getTime() + 7200000).toISOString(),
    ]);
    assert.equal(
      (await db.query("select * from public.calendar_deliveries where claim_token is null")).rows
        .length,
      2,
    );
    const block = (
      await db.query<{ id: string }>("select public.create_calendar_block($1,$2,$3,'Lunch') id", [
        org,
        start,
        end,
      ])
    ).rows[0].id;
    assert.ok(block);
    await assert.rejects(request, /unavailable/);
    const early = new Date(monday);
    early.setUTCHours(7);
    const earlyLead = await capture();
    await assert.rejects(
      () => db.query("select public.request_booking($1,$2)", [earlyLead, early.toISOString()]),
      /working hours/,
    );
    const own = (
      await db.query<{ data: unknown[] }>("select public.workspace_calendar($1,$2,$3) data", [
        org,
        new Date(monday.getTime() - 86400000).toISOString(),
        new Date(monday.getTime() + 86400000).toISOString(),
      ])
    ).rows[0].data;
    assert.equal(own.length, 2);
    assert.deepEqual(
      (
        await db.query<{ data: unknown[] }>("select public.workspace_calendar($1,$2,$3) data", [
          other,
          start,
          new Date(monday.getTime() + 86400000).toISOString(),
        ])
      ).rows[0].data,
      [],
    );
    await db.query(
      "insert into public.calendar_oauth_states(id,organization_id,user_id,provider,verifier,expires_at) values('state',$1,$2,'google','encrypted',now()+interval '10 minutes')",
      [org, user],
    );
    const consume = async (who: string) =>
      db.query(
        "delete from public.calendar_oauth_states where id='state' and organization_id=$1 and user_id=$2 and provider='google' and expires_at>now() returning verifier",
        [org, who],
      );
    assert.equal((await consume(otherUser)).rows.length, 0);
    assert.equal((await consume(user)).rows.length, 1);
    assert.equal((await consume(user)).rows.length, 0);
    await db.query(
      "insert into public.calendar_oauth_states(id,organization_id,user_id,provider,verifier,expires_at) values('state',$1,$2,'google','encrypted',now()-interval '1 second')",
      [org, user],
    );
    assert.equal((await consume(user)).rows.length, 0);
    await db.query(
      "update public.calendar_deliveries set next_attempt_at=now()-interval '1 second' where status='pending'",
    );
    const old = (
      await db.query<{
        data: { booking_id: string; provider: string; revision: string; claim_token: string }[];
      }>("select public.claim_calendar_deliveries(10) data")
    ).rows[0].data.find((item) => item.booking_id === b)!;
    await db.query(
      "update public.calendar_connections set revision=gen_random_uuid() where organization_id=$1 and provider=$2",
      [org, old.provider],
    );
    assert.equal(
      (
        await db.query(
          "update public.calendar_deliveries set status='synced' where booking_id=$1 and provider=$2 and revision=$3 and claim_token=$4 returning booking_id",
          [old.booking_id, old.provider, old.revision, old.claim_token],
        )
      ).rows.length,
      0,
    );
    await db.exec("grant usage on schema public to authenticated; set role authenticated");
    for (const table of [
      "calendar_connections",
      "calendar_oauth_states",
      "calendar_deliveries",
      "booking_settings",
      "calendar_blocks",
    ])
      await assert.rejects(() => db.query(`select * from public.${table}`), /permission denied/);
    await assert.rejects(
      () => db.query("select public.workspace_calendar($1,$2,$3)", [org, start, end]),
      /permission denied/,
    );
    await db.exec("reset role");
    await db.query("delete from public.calendar_connections where organization_id=$1", [org]);
    assert.equal((await db.query("select * from public.calendar_deliveries")).rows.length, 0);
  } finally {
    await db.close();
  }
});
test("provider availability excludes free/cancelled events, handles pages, and reports provider failures", async (t) => {
  const previous = { ...process.env };
  Object.assign(process.env, {
    CALENDAR_ENCRYPTION_KEY: "b".repeat(64),
    GOOGLE_CALENDAR_CLIENT_ID: "test",
    GOOGLE_CALENDAR_CLIENT_SECRET: "test",
    NEXT_PUBLIC_APP_URL: "https://app.example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://db.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "test",
  });
  t.after(() => {
    for (const name of Object.keys(process.env)) if (!(name in previous)) delete process.env[name];
    Object.assign(process.env, previous);
  });
  const encrypted = encryptCalendarSecret("refresh", "org/google");
  let scenario = "valid";
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.hostname === "db.example.test")
      return Response.json({ refresh_token: encrypted, revision: "rev", provider: "google" });
    if (url.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "access" });
    assert.equal(url.hostname, "www.googleapis.com");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer access");
    if (scenario === "failure") return Response.json({}, { status: 503 });
    if (url.searchParams.has("pageToken"))
      return Response.json({
        items: [
          {
            id: "busy",
            start: { dateTime: "2026-10-08T12:00:00Z" },
            end: { dateTime: "2026-10-08T13:00:00Z" },
          },
        ],
      });
    return Response.json({
      items: [
        { id: "free", transparency: "transparent" },
        { id: "cancelled", status: "cancelled" },
        {
          id: "own",
          start: { dateTime: "2026-10-08T09:00:00Z" },
          end: { dateTime: "2026-10-08T10:00:00Z" },
        },
      ],
      nextPageToken: "next",
    });
  });
  assert.deepEqual(
    await providerBusy("org", "google", "2026-10-08T00:00:00Z", "2026-10-09T00:00:00Z", "own"),
    [{ start: "2026-10-08T12:00:00Z", end: "2026-10-08T13:00:00Z" }],
  );
  scenario = "failure";
  await assert.rejects(
    () => providerBusy("org", "google", "2026-10-08T00:00:00Z", "2026-10-09T00:00:00Z"),
    /Unable to check/,
  );
});
test("Google calendar event retries use deterministic IDs and cancellations are idempotent", async (t) => {
  const previous = { ...process.env };
  Object.assign(process.env, {
    CALENDAR_ENCRYPTION_KEY: "c".repeat(64),
    GOOGLE_CALENDAR_CLIENT_ID: "test",
    GOOGLE_CALENDAR_CLIENT_SECRET: "test",
    NEXT_PUBLIC_APP_URL: "https://app.example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://db.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "test",
  });
  t.after(() => {
    for (const name of Object.keys(process.env)) if (!(name in previous)) delete process.env[name];
    Object.assign(process.env, previous);
  });
  const encrypted = encryptCalendarSecret("refresh", "org/google");
  const methods: string[] = [];
  let id = "";
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.hostname === "db.example.test")
      return Response.json({ refresh_token: encrypted, revision: "rev", provider: "google" });
    if (url.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "access" });
    methods.push(init?.method ?? "GET");
    if (init?.method === "POST") {
      id = JSON.parse(String(init.body)).id;
      return Response.json({}, { status: 409 });
    }
    if (init?.method === "PATCH")
      return Response.json({}, { status: methods.length === 1 ? 404 : 200 });
    return Response.json({}, { status: 404 });
  });
  const booking = {
    id: "booking",
    starts_at: "2026-10-08T10:00:00Z",
    ends_at: "2026-10-08T11:00:00Z",
    status: "confirmed",
  };
  assert.equal(await writeCalendarBooking("org", "google", booking, null), id);
  assert.deepEqual(methods, ["PATCH", "POST", "PATCH"]);
  assert.equal(
    await writeCalendarBooking("org", "google", { ...booking, status: "cancelled" }, id),
    id,
  );
});

test("all-day Google events block only their local day across daylight saving", async (t) => {
  const vars = {
    CALENDAR_ENCRYPTION_KEY: "d".repeat(64),
    GOOGLE_CALENDAR_CLIENT_ID: "test",
    GOOGLE_CALENDAR_CLIENT_SECRET: "test",
    NEXT_PUBLIC_APP_URL: "https://app.example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://db.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "test",
  };
  const previous = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]));
  Object.assign(process.env, vars);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const encrypted = encryptCalendarSecret("refresh", "org/google");
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.hostname === "db.example.test")
      return Response.json({ refresh_token: encrypted, revision: "rev" });
    if (url.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "access" });
    assert.equal(url.hostname, "www.googleapis.com");
    return Response.json({
      timeZone: "Europe/Bucharest",
      items: [{ id: "all-day", start: { date: "2026-10-25" }, end: { date: "2026-10-26" } }],
    });
  });
  const busy = await providerBusy("org", "google", "2026-10-24T00:00:00Z", "2026-10-27T00:00:00Z");
  assert.deepEqual(busy, [{ start: "2026-10-24T21:00:00.000Z", end: "2026-10-25T22:00:00.000Z" }]);
  assert.equal(overlaps("2026-10-25T22:00:00Z", "2026-10-25T23:00:00Z", busy), false);
});

test("Outlook retries recover a created event and cancellation after a lost ID deletes it", async (t) => {
  const vars = {
    CALENDAR_ENCRYPTION_KEY: "e".repeat(64),
    MICROSOFT_CALENDAR_CLIENT_ID: "test",
    MICROSOFT_CALENDAR_CLIENT_SECRET: "test",
    NEXT_PUBLIC_APP_URL: "https://app.example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://db.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "test",
  };
  const previous = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]));
  Object.assign(process.env, vars);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const encrypted = encryptCalendarSecret("refresh", "org/outlook");
  let created = false,
    posts = 0,
    deletes = 0,
    patches = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.hostname === "db.example.test")
      return Response.json({ refresh_token: encrypted, revision: "rev" });
    if (url.hostname === "login.microsoftonline.com")
      return Response.json({ access_token: "access" });
    assert.equal(url.hostname, "graph.microsoft.com");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer access");
    if (init?.method === "POST") {
      posts++;
      created = true;
      const body = JSON.parse(String(init.body));
      assert.equal(body.transactionId, "booking");
      assert.equal(body.singleValueExtendedProperties[0].value, "org/booking");
      assert.equal(body.subject, "Service booking");
      assert.equal("attendees" in body, false);
      return Response.json({ id: "immutable-event" });
    }
    if (init?.method === "PATCH") {
      patches++;
      assert.equal("transactionId" in JSON.parse(String(init.body)), false);
      return Response.json({});
    }
    if (init?.method === "DELETE") {
      deletes++;
      assert.ok(url.pathname.endsWith("/immutable-event"));
      return new Response(null, { status: 204 });
    }
    assert.ok(url.searchParams.get("$filter")?.includes("org/booking"));
    return Response.json({ value: created ? [{ id: "immutable-event" }] : [] });
  });
  const booking = {
    id: "booking",
    starts_at: "2026-10-08T10:00:00Z",
    ends_at: "2026-10-08T11:00:00Z",
    status: "confirmed",
  };
  assert.equal(await writeCalendarBooking("org", "outlook", booking, null), "immutable-event");
  assert.equal(await writeCalendarBooking("org", "outlook", booking, null), "immutable-event");
  assert.equal(
    await writeCalendarBooking("org", "outlook", { ...booking, status: "cancelled" }, null),
    "immutable-event",
  );
  assert.equal(posts, 1);
  assert.equal(patches, 1);
  assert.equal(deletes, 1);
});

test("Outlook pagination cannot forward calendar tokens to a foreign destination", async (t) => {
  const vars = {
    CALENDAR_ENCRYPTION_KEY: "f".repeat(64),
    MICROSOFT_CALENDAR_CLIENT_ID: "test",
    MICROSOFT_CALENDAR_CLIENT_SECRET: "test",
    NEXT_PUBLIC_APP_URL: "https://app.example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://db.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "test",
  };
  const previous = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]));
  Object.assign(process.env, vars);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const encrypted = encryptCalendarSecret("refresh", "org/outlook");
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.hostname === "db.example.test")
      return Response.json({ refresh_token: encrypted, revision: "rev" });
    if (url.hostname === "login.microsoftonline.com")
      return Response.json({ access_token: "access" });
    assert.equal(url.hostname, "graph.microsoft.com");
    return Response.json({ value: [], "@odata.nextLink": "https://attacker.example.test/collect" });
  });
  await assert.rejects(
    () => providerBusy("org", "outlook", "2026-10-08T00:00:00Z", "2026-10-09T00:00:00Z"),
    /Invalid calendar API destination/,
  );
});

test("calendar worker retries provider failures, refuses replaced connections and guards lease completions", async (t) => {
  const vars = {
    CALENDAR_ENCRYPTION_KEY: "a".repeat(64),
    GOOGLE_CALENDAR_CLIENT_ID: "test",
    GOOGLE_CALENDAR_CLIENT_SECRET: "test",
    NEXT_PUBLIC_APP_URL: "https://app.example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://db.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "test",
  };
  const previous = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]));
  Object.assign(process.env, vars);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const { syncCalendars } = await import("../lib/server/calendar");
  const encrypted = encryptCalendarSecret("refresh", "org/google");
  let state = "accepted",
    claimed = false,
    calls = 0;
  const updates: Record<string, unknown>[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "access" });
    if (url.hostname === "www.googleapis.com") {
      calls++;
      return Response.json({}, { status: state === "retry" || state === "exhausted" ? 503 : 200 });
    }
    assert.equal(url.hostname, "db.example.test");
    if (url.pathname.endsWith("/claim_calendar_deliveries")) {
      const result = claimed
        ? []
        : [
            {
              organization_id: "org",
              provider: "google",
              booking_id: "booking",
              revision: "delivery-v1",
              connection_revision: "connection-v1",
              claim_token: "lease",
              attempts: state === "exhausted" ? 5 : 1,
              external_id: "event",
            },
          ];
      claimed = true;
      return Response.json(result);
    }
    if (url.pathname.endsWith("/calendar_connections"))
      return Response.json({
        revision: state === "changed" ? "connection-v2" : "connection-v1",
        refresh_token: encrypted,
      });
    if (url.pathname.endsWith("/organizations"))
      return Response.json({
        id: "org",
        name: "Service",
        trial_ends_at: "2020-01-01",
        stripe_account_id: null,
      });
    if (url.pathname.endsWith("/billing_subscriptions"))
      return Response.json(
        state === "downgraded"
          ? []
          : [
              {
                plan: "business",
                status: "active",
                current_period_end: new Date(Date.now() + 86400000).toISOString(),
              },
            ],
      );
    if (url.pathname.endsWith("/bookings"))
      return Response.json({
        id: "booking",
        starts_at: "2026-10-08T10:00:00Z",
        ends_at: "2026-10-08T11:00:00Z",
        status: state === "cancelled" ? "cancelled" : "confirmed",
      });
    if (url.pathname.endsWith("/calendar_deliveries")) {
      assert.equal(url.searchParams.get("revision"), "eq.delivery-v1");
      assert.equal(url.searchParams.get("claim_token"), "eq.lease");
      assert.equal(url.searchParams.get("organization_id"), "eq.org");
      updates.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });
  for (const scenario of ["accepted", "retry", "exhausted", "changed", "downgraded", "cancelled"]) {
    state = scenario;
    claimed = false;
    calls = 0;
    updates.length = 0;
    const result = await syncCalendars();
    assert.equal(updates.length, 1);
    if (["changed", "downgraded"].includes(state)) {
      assert.equal(calls, 0);
      assert.equal(updates[0].status, "failed");
    } else if (["accepted", "cancelled"].includes(state)) {
      assert.equal(calls, 1);
      assert.equal(updates[0].status, "synced");
      assert.equal(result.synced, 1);
    } else {
      assert.equal(calls, 1);
      assert.equal(updates[0].status, state === "exhausted" ? "failed" : "pending");
      assert.equal(result.failed, 1);
    }
  }
});
