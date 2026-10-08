import { locales, translate, type Locale } from "./i18n";
import { inferredUnit, measurementSystem, unitlessLabel } from "./units";
import type { Question, QuoteTemplate, PublicQuoteConfig } from "./types";
export function localizeQuestion(q: Question, locale: Locale): Question {
  const content = q.translations?.[locale];
  return {
    ...q,
    unit: inferredUnit(q),
    label: content?.label ?? translate(unitlessLabel(q.label), locale),
    help: content?.help ?? (q.help ? translate(q.help, locale) : undefined),
    options: q.options?.map((o) => ({
      ...o,
      label: content?.options?.[o.value] ?? translate(o.label, locale),
    })),
  };
}
export function localizeConfig(config: PublicQuoteConfig, locale: Locale): PublicQuoteConfig {
  const content = config.translations?.[locale];
  return {
    ...config,
    name: content?.name ?? translate(config.name, locale),
    description: content?.description ?? translate(config.description, locale),
    industry: content?.industry ?? translate(config.industry, locale),
    questions: config.questions.map((q) => localizeQuestion(q, locale)),
  };
}
export function prepareTemplate(template: QuoteTemplate, locale: Locale): QuoteTemplate {
  const metric = measurementSystem(structuredClone(template), "metric");
  return {
    ...metric,
    currency: locale === "ro" ? "RON" : "EUR",
    settings: { ...metric.settings, locale, languages: [...locales] },
    translations: Object.fromEntries(
      locales.map((lang) => [
        lang,
        {
          name: translate(template.name, lang),
          industry: translate(template.industry, lang),
          description: translate(template.description, lang),
        },
      ]),
    ),
    questions: metric.questions.map((q) => ({
      ...q,
      label: unitlessLabel(q.label),
      unit: inferredUnit(q),
      translations: Object.fromEntries(
        locales.map((lang) => [
          lang,
          {
            label: translate(unitlessLabel(q.label), lang),
            help: q.help ? translate(q.help, lang) : undefined,
            options: Object.fromEntries(
              (q.options ?? []).map((o) => [o.value, translate(o.label, lang)]),
            ),
          },
        ]),
      ),
    })),
  };
}
