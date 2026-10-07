import assert from "node:assert/strict";
import test from "node:test";
import { templates, getTemplate } from "../lib/templates";
import { calculateQuote, visibleQuestions } from "../lib/pricing-engine";
import { quoteTemplateSchema } from "../lib/server/schemas";
import type { Answers, QuoteTemplate } from "../lib/types";

function answersFor(template: QuoteTemplate): Answers {
  return Object.fromEntries(
    template.questions.map((q) => [
      q.id,
      q.type === "number"
        ? Math.max(q.min ?? 0, 10)
        : q.type === "choice"
          ? q.options![0].value
          : q.type === "multiselect"
            ? []
            : "10001",
    ]),
  );
}

test("every trade template and each service option can be saved and quoted", () => {
  assert.equal(templates.length, 15);
  for (const template of templates) {
    assert.equal(quoteTemplateSchema.safeParse(template).success, true, template.slug);
    const restored = quoteTemplateSchema.parse(JSON.parse(JSON.stringify(template)));
    const defaults = answersFor(restored);
    for (const question of restored.questions.filter((q) => q.options)) {
      for (const option of question.options!) {
        const answers = {
          ...defaults,
          [question.id]: question.type === "multiselect" ? [option.value] : option.value,
        };
        const quote = calculateQuote(restored, answers);
        assert.ok(
          Number.isFinite(quote.subtotal) && quote.low >= 0 && quote.high >= quote.low,
          `${template.slug}/${question.id}/${option.value}`,
        );
      }
    }
  }
});

test("painting charges separate interior, exterior and selected extra quantities", () => {
  const painting = getTemplate("painting")!;
  const base: Answers = {
    scope: "interior",
    area: 1000,
    stories: "1",
    condition: "good",
    postcode: "10001",
    extras: [],
  };
  assert.equal(calculateQuote(painting, base).subtotal, 2100);
  assert.throws(() => calculateQuote(painting, { ...base, extras: ["doors"] }));
  assert.throws(() => calculateQuote(painting, { ...base, extras: ["doors"], doors_quantity: 0 }));
  assert.equal(
    calculateQuote(painting, { ...base, scope: "exterior", exterior_area: 1000 }).subtotal,
    2750,
  );
  assert.equal(
    calculateQuote(painting, { ...base, scope: "both", exterior_area: 1000 }).subtotal,
    4600,
  );
  assert.equal(
    calculateQuote(painting, { ...base, extras: ["doors"], doors_quantity: 3 }).subtotal,
    2370,
  );
  assert.equal(calculateQuote(painting, { ...base, doors_quantity: 99 }).subtotal, 2100);
});

test("roofing and HVAC diagnostics ignore stale installation measurements", () => {
  for (const [slug, fee] of [
    ["roofing", 150],
    ["hvac", 100],
  ] as const) {
    const template = getTemplate(slug)!;
    const answers = {
      ...answersFor(template),
      job: "repair",
      area: 90000,
      home_size: 19000,
      tearoff_area: 80000,
    };
    assert.equal(calculateQuote(template, answers).subtotal, fee);
    assert.equal(
      visibleQuestions(template, answers).some((q) =>
        ["area", "home_size", "tearoff_area"].includes(q.id),
      ),
      false,
    );
  }
});

test("business can change units, rates, options and tax then round-trip configuration", () => {
  for (const original of templates) {
    const custom = structuredClone(original);
    custom.currency = "EUR";
    custom.settings = { taxRatePct: 20 };
    custom.minPrice = 0;
    const rule = custom.rules.find((r) => r.kind === "number");
    if (rule?.kind === "number") {
      custom.questions.find((q) => q.id === rule.field)!.label =
        "Quantity in business-selected units";
      rule.perUnit = 7.25;
    }
    const restored = quoteTemplateSchema.parse(JSON.parse(JSON.stringify(custom)));
    const quote = calculateQuote(restored, answersFor(restored));
    assert.equal(quote.currency, "EUR");
    assert.ok(
      quote.breakdown.some((item) => item.label === "Tax (20%)"),
      original.slug,
    );
  }
});

test("conditional quantity rates validate references and charge only matching services", () => {
  const template = structuredClone(getTemplate("photography")!);
  const answers = { ...answersFor(template), extras: [], hours: 4 };
  const without = calculateQuote(template, answers).subtotal;
  assert.equal(
    calculateQuote(template, { ...answers, extras: ["second"] }).subtotal - without,
    300,
  );
  const rate = template.rules.find((r) => r.kind === "number" && r.when);
  if (rate?.kind !== "number") throw new Error("Conditional rate missing");
  rate.when = [{ field: "missing", op: "eq", value: "yes" }];
  assert.equal(quoteTemplateSchema.safeParse(template).success, false);
});
