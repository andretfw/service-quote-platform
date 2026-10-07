import assert from "node:assert/strict";
import test from "node:test";
import { templates } from "../lib/templates";
import { calculateQuote, visibleQuestions } from "../lib/pricing-engine";
import {
  convertQuestionUnit,
  inferredUnit,
  measurementSystem,
  units,
  unitlessLabel,
} from "../lib/units";
import { prepareTemplate, localizeQuestion, localizeConfig } from "../lib/localization";
import { quoteTemplateSchema } from "../lib/server/schemas";
import { locales, translate, preferredLocale } from "../lib/i18n";
import messages from "../lib/i18n/messages.json";
import { toPublicQuoteConfig } from "../lib/server/calculator-resolver";
import { leadNotificationMessage } from "../lib/server/notification-message";
import type { Answers, QuoteTemplate } from "../lib/types";

function sample(template: QuoteTemplate): Answers {
  const answers: Answers = {};
  for (const q of template.questions)
    answers[q.id] =
      q.type === "number"
        ? Math.min(q.max ?? 100, Math.max(q.min ?? 0, 100))
        : q.type === "choice"
          ? q.options![0].value
          : q.type === "multiselect"
            ? q.options!.map((o) => o.value)
            : "Sample";
  return answers;
}

test("every template has complete Spanish and Romanian content and survives localized persistence", () => {
  const dictionary = messages as Record<string, unknown>;
  for (const template of templates) {
    for (const text of [
      template.name,
      template.industry,
      template.description,
      ...template.questions.flatMap((q) => [
        unitlessLabel(q.label),
        ...(q.help ? [q.help] : []),
        ...(q.options ?? []).map((o) => o.label),
      ]),
    ]) {
      if (/[a-z]/i.test(text)) assert.ok(dictionary[text], `Missing translation: ${text}`);
    }
    for (const locale of locales) {
      const prepared = prepareTemplate(template, locale);
      const parsed = quoteTemplateSchema.parse(prepared);
      assert.equal(parsed.settings?.locale, locale);
      assert.deepEqual(parsed.settings?.languages, locales);
      assert.equal(prepared.currency, locale === "ro" ? "RON" : "EUR");
      for (const q of parsed.questions) {
        const localized = localizeQuestion(q, locale);
        assert.equal(localized.id, q.id);
        assert.deepEqual(
          localized.options?.map((o) => o.value),
          q.options?.map((o) => o.value),
        );
        assert.ok(!/sq ft|linear ft|miles|cubic yards/.test(localized.label));
      }
    }
  }
});

test("metric conversions preserve all template prices and round-trip their rates", () => {
  for (const template of templates) {
    const source = structuredClone(template);
    const original = sample(source);
    const metric = measurementSystem(source, "metric");
    const converted = { ...original };
    for (const q of source.questions) {
      const from = inferredUnit(q),
        to = inferredUnit(metric.questions.find((x) => x.id === q.id)!);
      if (from && to)
        converted[q.id] = (Number(original[q.id]) * units[from].factor) / units[to].factor;
    }
    assert.equal(
      calculateQuote(source, original).subtotal,
      calculateQuote(metric, converted).subtotal,
      template.slug,
    );
    assert.deepEqual(
      visibleQuestions(source, original).map((q) => q.id),
      visibleQuestions(metric, converted).map((q) => q.id),
    );
    const back = measurementSystem(metric, "imperial");
    assert.equal(
      calculateQuote(source, original).subtotal,
      calculateQuote(back, original).subtotal,
      template.slug,
    );
    assert.deepEqual(template, source, "conversion must not mutate the original");
  }
});

test("unit conversion includes numeric visibility thresholds and billable limits, and rejects dimension changes", () => {
  const template: QuoteTemplate = {
    slug: "unit-test",
    name: "Test",
    industry: "Test",
    description: "Test",
    currency: "EUR",
    questions: [
      { id: "area", label: "Area", type: "number", unit: "m2", min: 1, max: 100, step: 1 },
      {
        id: "extra",
        label: "Extra",
        type: "text",
        showWhen: [{ field: "area", op: "gte", value: 10 }],
      },
    ],
    rules: [
      {
        kind: "number",
        field: "area",
        perUnit: 12,
        minUnits: 10,
        maxUnits: 50,
        when: [{ field: "area", op: "gte", value: 5 }],
      },
      { kind: "conditional", when: [{ field: "area", op: "gt", value: 10 }], amount: 30 },
    ],
  };
  const cm = convertQuestionUnit(template, "area", "cm2");
  assert.equal(cm.questions[0].min, 10000);
  assert.equal(cm.questions[1].showWhen?.[0].value, 100000);
  assert.equal(
    calculateQuote(template, { area: 20, extra: "Yes" }).subtotal,
    calculateQuote(cm, { area: 200000, extra: "Yes" }).subtotal,
  );
  assert.throws(() => convertQuestionUnit(template, "area", "cm"), /Incompatible/);
  assert.throws(() => convertQuestionUnit(template, "extra", "cm"), /Only quantities/);
  assert.equal(
    quoteTemplateSchema.safeParse({ ...template, settings: { locale: "ro", languages: ["en"] } })
      .success,
    false,
  );
});

test("customer language leaves calculation identifiers private and translates email content safely", () => {
  const template = prepareTemplate(templates[0], "ro");
  const config = localizeConfig(
    { publicId: "painting", ...template, canCaptureLeads: false },
    "es",
  );
  assert.equal(config.questions[0].label, "¿Qué quieres pintar?");
  assert.equal(config.questions[0].options?.[0].value, "interior");
  assert.equal(
    translate("Question {current} of {total}", "ro", { current: 1, total: 3 }),
    "Întrebarea 1 din 3",
  );
  const email = leadNotificationMessage(
    {
      id: "test",
      name: "<script>",
      email: "customer@example.test",
      phone: null,
      calculatorName: "Zugrăveli",
      estimate: "100 RON",
      answers: [],
    },
    "https://example.test",
    "ro",
  );
  assert.match(email.subject, /Solicitare nouă/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.equal(email.reply_to, "customer@example.test");
});

test("legacy calculators gain language controls without changing their prices or public privacy boundary", () => {
  const legacy = structuredClone(templates[0]);
  const config = toPublicQuoteConfig({
    publicId: "saved",
    calculatorId: "id",
    template: legacy,
    plan: "basic",
  });
  assert.deepEqual(config.languages, locales);
  assert.equal(config.currency, legacy.currency);
  assert.equal("rules" in config, false);
  assert.equal("minPrice" in config, false);
  assert.deepEqual(legacy, templates[0]);
});

test("browser language preferences select supported locales without overriding explicit choices", () => {
  assert.equal(preferredLocale("ro-RO,es;q=0.8,en;q=0.5"), "ro");
  assert.equal(preferredLocale("de;q=1,es-ES;q=0.9,en;q=0.4"), "es");
  assert.equal(preferredLocale("ro;q=0,en;q=1"), "en");
  assert.equal(preferredLocale("fr-FR"), "en");
});
