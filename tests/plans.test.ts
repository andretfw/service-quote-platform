import assert from "node:assert/strict";
import test from "node:test";
import { effectivePlan, plans, isPlanId, isPaidPlanId, paidPlanIds } from "../lib/plans";
import { csvCell } from "../lib/csv";
import { unsubscribeToken, verifyUnsubscribeToken } from "../lib/unsubscribe";

const now = Date.parse("2026-10-01T00:00:00Z");
const future = "2026-11-01T00:00:00Z";

test("new accounts and inactive subscriptions receive permanent Free access", () => {
  assert.equal(effectivePlan(null, now), "free");
  assert.equal(effectivePlan(null, now + 365 * 86400000), "free");
  for (const status of [
    "canceled",
    "past_due",
    "unpaid",
    "paused",
    "incomplete",
    "incomplete_expired",
  ]) {
    assert.equal(
      effectivePlan({ plan: "business", status, current_period_end: future }, now),
      "free",
    );
  }
  assert.equal(
    effectivePlan({ plan: "premium", status: "active", current_period_end: "invalid" }, now),
    "free",
  );
  assert.equal(
    effectivePlan(
      { plan: "basic", status: "active", current_period_end: "2026-09-01T00:00:00Z" },
      now,
    ),
    "free",
  );
});

test("only known active paid subscriptions grant paid features", () => {
  for (const status of ["active", "trialing"]) {
    for (const plan of paidPlanIds)
      assert.equal(effectivePlan({ plan, status, current_period_end: future }, now), plan);
  }
  assert.equal(
    effectivePlan({ plan: "enterprise", status: "active", current_period_end: future }, now),
    "free",
  );
  assert.equal(isPlanId("__proto__"), false);
  assert.equal(isPlanId("free"), true);
  assert.equal(isPaidPlanId("free"), false);
  assert.equal(plans.free.monthlyLeads, 7);
  assert.equal(plans.basic.monthlyLeads, 100);
  for (const feature of ["branding", "exports", "followUps", "bookings", "deposits"] as const)
    assert.equal(plans.free[feature], false);
  assert.equal(plans.premium.bookings, false);
  assert.equal(plans.business.deposits, true);
});

test("CSV exports neutralize spreadsheet formula injection", () => {
  for (const value of ['=HYPERLINK("x")', "+cmd", "@SUM(1)", "  -1+2", "\tformula"])
    assert.ok(csvCell(value).startsWith("\"'"));
  assert.equal(csvCell('a"b'), '"a""b"');
});

test("unsubscribe token is scoped, signed and expires", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const token = unsubscribeToken(id, "test-secret", now);
  assert.equal(verifyUnsubscribeToken(token, "test-secret", now), id);
  assert.equal(verifyUnsubscribeToken(token, "different-secret", now), null);
  assert.equal(
    verifyUnsubscribeToken(token.replace("11111111", "22222222"), "test-secret", now),
    null,
  );
  assert.equal(verifyUnsubscribeToken(token, "test-secret", now + 91 * 86400000), null);
});

test("published monthly plans use the selected EUR prices", () => {
  assert.deepEqual(
    paidPlanIds.map((id) => plans[id].monthlyEur),
    [9, 19, 39],
  );
  assert.equal(plans.free.monthlyEur, 0);
});
