import { units, inferredUnit } from "./units";
import type { Locale } from "./i18n";
import { visibleQuestions } from "./pricing-engine";
import type { Answers, Question } from "./types";

export function formatEstimate(quote: unknown, locale: Locale = "en"): string {
  if (!quote || typeof quote !== "object") return "Estimate unavailable";
  const value = quote as Record<string, unknown>;
  if (
    typeof value.low !== "number" ||
    typeof value.high !== "number" ||
    value.low < 0 ||
    value.high < value.low ||
    !Number.isFinite(value.low) ||
    !Number.isFinite(value.high) ||
    typeof value.currency !== "string"
  )
    return "Estimate unavailable";
  try {
    const money = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: value.currency,
      maximumFractionDigits: 2,
    });
    return `${money.format(value.low)}–${money.format(value.high)}`;
  } catch {
    return "Estimate unavailable";
  }
}

export function answerSummary(
  questions: Question[],
  answers: Answers,
): { label: string; value: string }[] {
  const visible: Question[] = questions.length
    ? visibleQuestions({ questions }, answers)
    : Object.keys(answers).map((id) => ({ id, label: id.replaceAll("_", " "), type: "text" }));
  return visible.flatMap((question) => {
    const value = answers[question.id];
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && !value.length)
    )
      return [];
    const options = question.options;
    const display = (item: string | number | boolean) =>
      options?.find((option) => option.value === item)?.label ?? String(item);
    return [
      {
        label: `${question.label}${inferredUnit(question) ? ` (${units[inferredUnit(question)!].symbol})` : ""}`,
        value: Array.isArray(value) ? value.map(display).join(", ") : display(value),
      },
    ];
  });
}
