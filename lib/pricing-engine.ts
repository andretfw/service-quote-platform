import type {
  Answers,
  Condition,
  PublicQuoteResult,
  QuoteResult,
  QuoteTemplate,
  Question,
} from "./types";

export class QuoteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteValidationError";
  }
}

const parseFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim() === "") ||
  (Array.isArray(value) && value.length === 0);

const compare = (answer: unknown, condition: Condition): boolean => {
  switch (condition.op) {
    case "eq":
      return answer === condition.value;
    case "neq":
      return answer !== condition.value;
    case "gt": {
      const left = parseFiniteNumber(answer);
      const right = parseFiniteNumber(condition.value);
      return left !== null && right !== null && left > right;
    }
    case "gte": {
      const left = parseFiniteNumber(answer);
      const right = parseFiniteNumber(condition.value);
      return left !== null && right !== null && left >= right;
    }
    case "lt": {
      const left = parseFiniteNumber(answer);
      const right = parseFiniteNumber(condition.value);
      return left !== null && right !== null && left < right;
    }
    case "lte": {
      const left = parseFiniteNumber(answer);
      const right = parseFiniteNumber(condition.value);
      return left !== null && right !== null && left <= right;
    }
    case "includes":
      return Array.isArray(answer) && answer.includes(String(condition.value));
    case "truthy":
      return !isEmpty(answer);
  }
};

export const conditionsMatch = (
  conditions: Condition[] | undefined,
  answers: Answers,
): boolean =>
  !conditions?.length || conditions.every((condition) => compare(answers[condition.field], condition));

export const visibleQuestions = (
  template: Pick<QuoteTemplate, "questions">,
  answers: Answers,
): Question[] => template.questions.filter((question) => conditionsMatch(question.showWhen, answers));

export const validateAnswers = (template: QuoteTemplate, answers: Answers): string[] => {
  const errors: string[] = [];

  for (const question of visibleQuestions(template, answers)) {
    const value = answers[question.id];

    if (question.required && isEmpty(value)) {
      errors.push(`${question.id}: required`);
      continue;
    }

    if (isEmpty(value)) continue;

    if (question.type === "number") {
      const number = parseFiniteNumber(value);
      if (number === null) {
        errors.push(`${question.id}: invalid number`);
        continue;
      }
      if (question.min !== undefined && number < question.min) {
        errors.push(`${question.id}: below minimum`);
      }
      if (question.max !== undefined && number > question.max) {
        errors.push(`${question.id}: above maximum`);
      }
    }

    if ((question.type === "text" || question.type === "postcode") && typeof value !== "string") {
      errors.push(`${question.id}: invalid text`);
    }

    if (question.type === "choice" && question.options) {
      const allowed = new Set(question.options.map((option) => option.value));
      if (typeof value !== "string" || !allowed.has(value)) {
        errors.push(`${question.id}: invalid option`);
      }
    }

    if (question.type === "multiselect" && question.options) {
      const allowed = new Set(question.options.map((option) => option.value));
      if (
        !Array.isArray(value) ||
        value.some((item) => typeof item !== "string" || !allowed.has(item))
      ) {
        errors.push(`${question.id}: invalid options`);
      }
    }
  }

  return errors;
};

export const calculateQuote = (template: QuoteTemplate, answers: Answers): QuoteResult => {
  const errors = validateAnswers(template, answers);
  if (errors.length) throw new QuoteValidationError(errors.join(", "));

  // Ignore stale answers from questions that became hidden after an earlier
  // answer changed. Hidden inputs must never continue affecting the price.
  const visibleIds = new Set(visibleQuestions(template, answers).map((question) => question.id));
  const effectiveAnswers = Object.fromEntries(
    Object.entries(answers).filter(([field]) => visibleIds.has(field)),
  ) as Answers;

  let total = 0;
  const breakdown: QuoteResult["breakdown"] = [];
  const multipliers: number[] = [];

  const add = (label: string, amount: number): void => {
    if (!Number.isFinite(amount)) throw new Error(`Invalid pricing rule result: ${label}`);
    total += amount;
    if (amount !== 0) breakdown.push({ label, amount });
  };

  for (const rule of template.rules) {
    switch (rule.kind) {
      case "base":
        add("Base price", rule.amount);
        break;
      case "number": {
        const parsed = parseFiniteNumber(effectiveAnswers[rule.field]);
        const rawUnits = parsed ?? 0;
        const units = Math.min(
          rule.maxUnits ?? Number.POSITIVE_INFINITY,
          Math.max(rule.minUnits ?? Number.NEGATIVE_INFINITY, rawUnits),
        );
        add(rule.field, units * rule.perUnit);
        break;
      }
      case "choice":
        add(rule.field, rule.map[String(effectiveAnswers[rule.field] ?? "")] ?? 0);
        break;
      case "multiselect": {
        const answer = effectiveAnswers[rule.field];
        const selected: string[] = Array.isArray(answer) ? answer : [];
        add(
          rule.field,
          selected.reduce((sum, item) => sum + (rule.map[item] ?? 0), 0),
        );
        break;
      }
      case "conditional":
        if (conditionsMatch(rule.when, effectiveAnswers)) add("Conditional adjustment", rule.amount);
        break;
      case "multiplier":
        multipliers.push(rule.map[String(effectiveAnswers[rule.field] ?? "")] ?? 1);
        break;
    }
  }

  for (const multiplier of multipliers) {
    if (!Number.isFinite(multiplier) || multiplier < 0) {
      throw new Error("Invalid pricing multiplier");
    }
    total *= multiplier;
  }

  const minimum = template.minPrice ?? 0;
  const subtotal = Math.round(Math.max(minimum, total) * 100) / 100;
  const rangePct = template.rangePct ?? 0.08;

  if (!Number.isFinite(rangePct) || rangePct < 0 || rangePct >= 1) {
    throw new Error("Invalid estimate range");
  }

  return {
    subtotal,
    low: Math.round(subtotal * (1 - rangePct) * 100) / 100,
    high: Math.round(subtotal * (1 + rangePct) * 100) / 100,
    currency: template.currency,
    breakdown,
  };
};

export const toPublicQuoteResult = (quote: QuoteResult): PublicQuoteResult => ({
  low: quote.low,
  high: quote.high,
  currency: quote.currency,
});
