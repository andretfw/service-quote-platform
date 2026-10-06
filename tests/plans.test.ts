import assert from "node:assert/strict";
import test from "node:test";
import { effectivePlan, plans, isPlanId } from "../lib/plans";
import { csvCell } from "../lib/csv";
import { unsubscribeToken, verifyUnsubscribeToken } from "../lib/unsubscribe";

const now = Date.parse("2026-10-01T00:00:00Z");
const future = "2026-11-01T00:00:00Z";

test("trial grants Basic until expiry and cannot revive canceled subscriptions", () => {
  assert.equal(effectivePlan(null, future, now), "basic");
  assert.equal(effectivePlan(null, "2026-09-01T00:00:00Z", now), null);
  assert.equal(
    effectivePlan(
      { plan: "business", status: "canceled", current_period_end: future },
      future,
      now,
    ),
    null,
  );
});

test("only active, unexpired, known plans grant features", () => {
  for (const status of ["past_due", "unpaid", "paused", "incomplete", "incomplete_expired"])
    assert.equal(
      effectivePlan({ plan: "business", status, current_period_end: future }, future, now),
      null,
    );
  assert.equal(
    effectivePlan({ plan: "business", status: "active", current_period_end: future }, future, now),
    "business",
  );
  assert.equal(
    effectivePlan(
      { plan: "premium", status: "active", current_period_end: "invalid" },
      future,
      now,
    ),
    null,
  );
  assert.equal(
    effectivePlan(
      { plan: "enterprise", status: "active", current_period_end: future },
      future,
      now,
    ),
    null,
  );
  assert.equal(isPlanId("__proto__"), false);
  assert.equal(plans.basic.deposits, false);
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
