import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migrations enforce workspace isolation, billing access, limits, revision locks and consent", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`,
    );
    for (const file of (await readdir("supabase/migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort()) {
      const sql = (await readFile(`supabase/migrations/${file}`, "utf8")).replace(
        "create extension if not exists pgcrypto;",
        "",
      );
      await db.exec(sql);
    }
    const userA = "11111111-1111-4111-8111-111111111111";
    const userB = "22222222-2222-4222-8222-222222222222";
    await db.query("insert into auth.users values ($1,'a@example.test'),($2,'b@example.test')", [
      userA,
      userB,
    ]);
    const workspace = async (user: string) =>
      (
        await db.query<{ id: string }>(
          "select public.get_or_create_default_organization($1,'Test') as id",
          [user],
        )
      ).rows[0].id;
    const a = await workspace(userA);
    const b = await workspace(userB);
    assert.equal(await workspace(userA), a);
    assert.equal(
      (await db.query<{ plan: string }>("select public.workspace_plan($1) as plan", [a])).rows[0]
        .plan,
      "basic",
    );
    const create = async (org: string, name: string) =>
      (
        await db.query<{ id: string }>(
          "select public.create_calculator_with_version($1,$2,$2,'cleaning','{}','[]') as id",
          [org, name],
        )
      ).rows[0].id;
    const calculator = await create(a, "calculator-a");
    await assert.rejects(() => create(a, "calculator-extra"), /Calculator limit/);
    const other = await create(b, "calculator-b");
    await assert.rejects(
      () =>
        db.query("select public.revise_calculator($1,$2,1,'Changed','{}','[]')", [b, calculator]),
      /Calculator not found/,
    );
    await db.query("select public.revise_calculator($1,$2,1,'Changed','{}','[]')", [a, calculator]);
    await assert.rejects(
      () =>
        db.query("select public.revise_calculator($1,$2,1,'Changed','{}','[]')", [a, calculator]),
      /reload/,
    );
    const capture = async (id: string, hash: string) =>
      (
        await db.query<{ id: string }>(
          "select public.capture_submission($1,'cleaning','{}','{}','Customer','customer@example.test',null,$2,true) as id",
          [id, hash],
        )
      ).rows[0].id;
    const submission = await capture(calculator, "a".repeat(64));
    const row = (
      await db.query<{ next_follow_up_at: string | null }>(
        "select next_follow_up_at from public.submissions where id=$1",
        [submission],
      )
    ).rows[0];
    assert.equal(row.next_follow_up_at, null);
    assert.equal((await db.query("select * from public.notification_outbox")).rows.length, 1);
    await capture(other, "b".repeat(64));
    await db.query(
      "insert into public.workspace_usage values ($1,date_trunc('month',now() at time zone 'UTC')::date,49) on conflict(organization_id,month) do update set leads=49",
      [a],
    );
    await capture(calculator, "c".repeat(64));
    await assert.rejects(() => capture(calculator, "d".repeat(64)), /Monthly lead limit/);
    assert.equal(
      (
        await db.query<{ leads: number }>(
          "select leads from public.workspace_usage where organization_id=$1",
          [a],
        )
      ).rows[0].leads,
      50,
    );
    await db.query("update public.organizations set stripe_customer_id='cus_a' where id=$1", [a]);
    await db.query(
      "select public.sync_billing_subscription($1,'cus_a','sub_a','premium','active',now()+interval '30 days',false,now())",
      [a],
    );
    await create(a, "calculator-premium");
    await assert.rejects(
      () => db.query("select public.request_booking($1,now()+interval '2 days')", [submission]),
      /Booking requests are not enabled/,
    );
    const reservation1 = (
      await db.query<{ reservation: { token: string; plan: string } }>(
        "select public.reserve_subscription_checkout($1,'basic') as reservation",
        [b],
      )
    ).rows[0].reservation;
    const reservation2 = (
      await db.query<{ reservation: { token: string; plan: string } }>(
        "select public.reserve_subscription_checkout($1,'business') as reservation",
        [b],
      )
    ).rows[0].reservation;
    assert.equal(reservation1.token, reservation2.token);
    assert.equal(reservation2.plan, "basic");
    await assert.rejects(
      () => db.query("select public.reserve_subscription_checkout($1,'business')", [a]),
      /existing subscription/,
    );
    await assert.rejects(
      () => db.query("select public.set_calculator_archived($1,$2,true)", [b, calculator]),
      /Calculator not found/,
    );
    await db.query(
      "select public.sync_billing_subscription($1,'cus_a','sub_a','business','active',now()+interval '30 days',false,now()+interval '0.1 second')",
      [a],
    );
    await db.query(
      "select public.revise_calculator($1,$2,2,'Booking calculator','{\"settings\":{\"bookingRequests\":true,\"deposits\":true}}','[]')",
      [a, calculator],
    );
    const booking = (
      await db.query<{ id: string }>(
        "select public.request_booking($1,now()+interval '2 days') as id",
        [submission],
      )
    ).rows[0].id;
    await assert.rejects(
      () => db.query("select public.request_booking($1,now()+interval '2 days')", [submission]),
      /duplicate key/,
    );
    await assert.rejects(
      () => db.query("select public.set_lead_status($1,$2,'won')", [a, submission]),
      /Resolve the active booking/,
    );
    await assert.rejects(
      () => db.query("select public.resolve_booking($1,$2,'cancelled')", [b, booking]),
      /Booking not found/,
    );
    await db.query("select public.resolve_booking($1,$2,'cancelled')", [a, booking]);
    await db.query("update public.organizations set stripe_account_id='acct_a' where id=$1", [a]);
    await db.query(
      'update public.submissions set quote=\'{"subtotal":100,"currency":"EUR"}\' where id=$1',
      [submission],
    );
    await assert.rejects(
      () =>
        db.query("select public.reserve_deposit_checkout($1,'acct_b',2000,'eur')", [submission]),
      /Deposits are not enabled/,
    );
    await assert.rejects(
      () => db.query("select public.reserve_deposit_checkout($1,'acct_a',100,'eur')", [submission]),
      /details changed/,
    );
    const deposit1 = (
      await db.query<{ reservation: { token: string } }>(
        "select public.reserve_deposit_checkout($1,'acct_a',2000,'eur') as reservation",
        [submission],
      )
    ).rows[0].reservation;
    const deposit2 = (
      await db.query<{ reservation: { token: string } }>(
        "select public.reserve_deposit_checkout($1,'acct_a',2000,'eur') as reservation",
        [submission],
      )
    ).rows[0].reservation;
    assert.equal(deposit1.token, deposit2.token);
    await db.query("select public.register_deposit_checkout($1,$2,'cs_test')", [
      submission,
      deposit1.token,
    ]);
    await db.query("select public.register_deposit_checkout($1,$2,'cs_test')", [
      submission,
      deposit1.token,
    ]);
    assert.equal(
      (await db.query("select * from public.payments where submission_id=$1", [submission])).rows
        .length,
      1,
    );
    await db.query(
      "update public.payments set status='paid' where stripe_checkout_session_id='cs_test'",
    );
    await assert.rejects(
      () =>
        db.query("select public.reserve_deposit_checkout($1,'acct_a',2000,'eur')", [submission]),
      /already been paid/,
    );
    await assert.rejects(
      () =>
        db.query("select public.release_expired_deposit_checkout($1,$2)", [
          submission,
          deposit1.token,
        ]),
      /already been paid/,
    );

    assert.equal(
      (
        await db.query<{ status: string }>("select status from public.submissions where id=$1", [
          submission,
        ])
      ).rows[0].status,
      "contacted",
    );
    const finishedBooking = (
      await db.query<{ id: string }>(
        "select public.request_booking($1,now()+interval '2 days') as id",
        [submission],
      )
    ).rows[0].id;
    await assert.rejects(
      () => db.query("select public.resolve_booking($1,$2,'completed')", [a, finishedBooking]),
      /Confirm the booking/,
    );
    await db.query("select public.resolve_booking($1,$2,'confirmed')", [a, finishedBooking]);
    await db.query("select public.resolve_booking($1,$2,'completed')", [a, finishedBooking]);
    assert.equal(
      (
        await db.query<{ status: string }>("select status from public.submissions where id=$1", [
          submission,
        ])
      ).rows[0].status,
      "won",
    );
    await db.query(
      "select public.sync_billing_subscription($1,'cus_a','sub_a','basic','active',now()+interval '30 days',false,now()+interval '0.2 second')",
      [a],
    );
    const calculatorIds = (
      await db.query<{ id: string }>(
        "select id from public.calculators where organization_id=$1 order by created_at,id",
        [a],
      )
    ).rows;
    assert.equal(
      (
        await db.query<{ enabled: boolean }>(
          "select public.calculator_accepts_leads($1) as enabled",
          [calculatorIds[0].id],
        )
      ).rows[0].enabled,
      true,
    );
    assert.equal(
      (
        await db.query<{ enabled: boolean }>(
          "select public.calculator_accepts_leads($1) as enabled",
          [calculatorIds[1].id],
        )
      ).rows[0].enabled,
      false,
    );
    await db.query("select public.set_calculator_archived($1,$2,true)", [a, calculatorIds[0].id]);
    assert.equal(
      (
        await db.query<{ enabled: boolean }>(
          "select public.calculator_accepts_leads($1) as enabled",
          [calculatorIds[1].id],
        )
      ).rows[0].enabled,
      true,
    );
    await assert.rejects(
      () =>
        db.query("select public.set_calculator_archived($1,$2,false)", [a, calculatorIds[0].id]),
      /Calculator limit/,
    );
    await db.query(
      "select public.sync_billing_subscription($1,'cus_a','sub_a','premium','canceled',now()+interval '30 days',false,now()+interval '1 second')",
      [a],
    );
    await db.query(
      "select public.sync_billing_subscription($1,'cus_a','sub_a','premium','active',now()+interval '30 days',false,now()-interval '1 second')",
      [a],
    );
    assert.equal(
      (await db.query<{ plan: string | null }>("select public.workspace_plan($1) as plan", [a]))
        .rows[0].plan,
      null,
    );
    await assert.rejects(() => capture(calculator, "d".repeat(64)), /Subscription required/);
    await assert.rejects(
      () => db.query("select public.set_lead_status($1,$2,'won')", [b, submission]),
      /Lead not found/,
    );
    await db.exec(
      "grant usage on schema public,auth to authenticated; grant select on all tables in schema public to authenticated; grant execute on function auth.uid() to authenticated;",
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userA]);
    await db.exec("set role authenticated");
    assert.equal((await db.query("select * from public.submissions")).rows.length, 2);
    assert.equal((await db.query("select * from public.billing_subscriptions")).rows.length, 1);
    assert.equal((await db.query("select * from public.notification_outbox")).rows.length, 0);
    await assert.rejects(
      () =>
        db.query(
          "select public.capture_submission($1,'cleaning','{}','{}','Customer','x@example.test',null,$2,false)",
          [calculator, "e".repeat(64)],
        ),
      /permission denied/,
    );
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});
