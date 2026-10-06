import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateQuote,
  conditionsMatch,
  toPublicQuoteResult,
  validateAnswers,
} from "../lib/pricing-engine";
import { getTemplate, templates } from "../lib/templates";

const sampleValue = (question: (typeof templates)[number]["questions"][number]) => {
  if (question.type === "number") return Math.max(question.min ?? 1, 10);
  if (question.type === "choice") return question.options?.[0]?.value ?? "x";
  if (question.type === "multiselect") return question.options?.slice(0, 1).map((o) => o.value) ?? [];
  if (question.type === "postcode") return "10001";
  return "test";
};

test("all bundled templates validate and produce sane quote ranges", () => {
  for (const template of templates) {
    const answers = Object.fromEntries(template.questions.map((q) => [q.id, sampleValue(q)]));
    assert.deepEqual(validateAnswers(template, answers), [], template.slug);

    const result = calculateQuote(template, answers);
    assert.ok(result.subtotal >= (template.minPrice ?? 0), template.slug);
    assert.ok(result.low <= result.subtotal, template.slug);
    assert.ok(result.subtotal <= result.high, template.slug);
  }
});

test("conditions compose with AND semantics", () => {
  assert.equal(
    conditionsMatch(
      [
        { field: "a", op: "eq", value: "yes" },
        { field: "b", op: "gte", value: 2 },
      ],
      { a: "yes", b: 3 },
    ),
    true,
  );
});

test("truthy conditions treat empty strings and empty selections as false", () => {
  assert.equal(conditionsMatch([{ field: "value", op: "truthy" }], { value: "   " }), false);
  assert.equal(conditionsMatch([{ field: "value", op: "truthy" }], { value: [] }), false);
  assert.equal(conditionsMatch([{ field: "value", op: "truthy" }], { value: "yes" }), true);
});

test("invalid numeric input is rejected instead of silently becoming zero", () => {
  const painting = getTemplate("painting");
  if (!painting) throw new Error("Painting template is missing");

  const answers = Object.fromEntries(painting.questions.map((q) => [q.id, sampleValue(q)]));
  answers.area = "not-a-number";

  assert.ok(validateAnswers(painting, answers).some((message) => message.includes("invalid number")));
  assert.throws(() => calculateQuote(painting, answers));
});

test("unknown choice values are rejected", () => {
  const painting = getTemplate("painting");
  if (!painting) throw new Error("Painting template is missing");

  const answers = Object.fromEntries(painting.questions.map((q) => [q.id, sampleValue(q)]));
  answers.scope = "made-up-choice";

  assert.ok(validateAnswers(painting, answers).some((message) => message.includes("invalid option")));
});

test("text questions reject non-text values and blank required text", () => {
  const template = {
    slug: "text-test",
    name: "Text test",
    industry: "Test",
    description: "Test template",
    currency: "USD",
    questions: [{ id: "postcode", label: "Postcode", type: "postcode" as const, required: true }],
    rules: [{ kind: "base" as const, amount: 100 }],
  };

  assert.ok(
    validateAnswers(template, { postcode: 123 }).some((message) =>
      message.includes("invalid text"),
    ),
  );
  assert.ok(
    validateAnswers(template, { postcode: "   " }).some((message) => message.includes("required")),
  );
});

test("hidden stale answers do not affect pricing", () => {
  const template = {
    slug: "conditional-test",
    name: "Conditional test",
    industry: "Test",
    description: "Test template",
    currency: "USD",
    questions: [
      {
        id: "include_extra",
        label: "Include extra?",
        type: "choice" as const,
        required: true,
        options: [
          { label: "Yes", value: "yes" },
          { label: "No", value: "no" },
        ],
      },
      {
        id: "extra",
        label: "Extra",
        type: "choice" as const,
        options: [{ label: "Premium", value: "premium" }],
        showWhen: [{ field: "include_extra", op: "eq" as const, value: "yes" }],
      },
    ],
    rules: [
      { kind: "base" as const, amount: 100 },
      { kind: "choice" as const, field: "extra", map: { premium: 500 } },
    ],
  };

  const result = calculateQuote(template, { include_extra: "no", extra: "premium" });
  assert.equal(result.subtotal, 100);
});

test("public quote results do not expose internal subtotal or pricing breakdown", () => {
  const painting = getTemplate("painting");
  if (!painting) throw new Error("Painting template is missing");

  const quote = calculateQuote(painting, {
    scope: "interior",
    area: 1000,
    stories: "1",
    condition: "good",
    extras: [],
    postcode: "10001",
  });
  const publicQuote = toPublicQuoteResult(quote);

  assert.deepEqual(publicQuote, { low: 1932, high: 2268, currency: "USD" });
  assert.equal("subtotal" in publicQuote, false);
  assert.equal("breakdown" in publicQuote, false);
});

test("bundled template question and option identifiers are unique", () => {
  for (const template of templates) {
    const questionIds = template.questions.map((question) => question.id);
    assert.equal(
      new Set(questionIds).size,
      questionIds.length,
      `${template.slug}: duplicate question id`,
    );

    for (const question of template.questions) {
      const optionValues = question.options?.map((option) => option.value) ?? [];
      assert.equal(
        new Set(optionValues).size,
        optionValues.length,
        `${template.slug}/${question.id}: duplicate option value`,
      );
    }
  }
});
