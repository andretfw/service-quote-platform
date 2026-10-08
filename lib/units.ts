import type { QuoteTemplate, Question, Condition } from "./types";
export const units = {
  m2: { symbol: "m²", dimension: "area", factor: 1 },
  ft2: { symbol: "ft²", dimension: "area", factor: 0.09290304 },
  cm2: { symbol: "cm²", dimension: "area", factor: 0.0001 },
  m: { symbol: "m", dimension: "length", factor: 1 },
  cm: { symbol: "cm", dimension: "length", factor: 0.01 },
  ft: { symbol: "ft", dimension: "length", factor: 0.3048 },
  km: { symbol: "km", dimension: "distance", factor: 1 },
  mi: { symbol: "mi", dimension: "distance", factor: 1.609344 },
  m3: { symbol: "m³", dimension: "volume", factor: 1 },
  yd3: { symbol: "yd³", dimension: "volume", factor: 0.764554857984 },
  kg: { symbol: "kg", dimension: "mass", factor: 1 },
  lb: { symbol: "lb", dimension: "mass", factor: 0.45359237 },
  hour: { symbol: "h", dimension: "time", factor: 1 },
  item: { symbol: "×", dimension: "count", factor: 1 },
} as const;
export type Unit = keyof typeof units;
export function inferredUnit(q: Question): Unit | undefined {
  if (q.unit) return q.unit;
  if (/\(sq ft\)/.test(q.label)) return "ft2";
  if (/\((linear )?ft\)/.test(q.label)) return "ft";
  if (/\(miles\)/.test(q.label)) return "mi";
  if (/\(cubic yards\)/.test(q.label)) return "yd3";
  if (q.type === "number" && /hours/i.test(q.label)) return "hour";
  return undefined;
}
export const unitlessLabel = (label: string) =>
  label.replace(/\s*\((sq ft|linear ft|ft|miles|cubic yards)\)/g, "");
export function convertQuestionUnit(template: QuoteTemplate, id: string, to: Unit): QuoteTemplate {
  const source = template.questions.find((q) => q.id === id);
  if (!source || source.type !== "number")
    throw new Error("Only quantities can have measurement units");
  const from = inferredUnit(source);
  if (from && units[from].dimension !== units[to].dimension)
    throw new Error("Incompatible measurement units");
  const ratio = from ? units[from].factor / units[to].factor : 1;
  const value = (n: number | undefined) => (n === undefined ? undefined : n * ratio);
  const condition = (c: Condition): Condition =>
    c.field === id && typeof c.value === "number" ? { ...c, value: c.value * ratio } : c;
  return {
    ...template,
    questions: template.questions.map((q) => ({
      ...q,
      ...(q.id === id
        ? {
            unit: to,
            label: unitlessLabel(q.label),
            min: value(q.min),
            max: value(q.max),
            step: value(q.step),
          }
        : {}),
      showWhen: q.showWhen?.map(condition),
    })),
    rules: template.rules.map((r) =>
      r.kind === "number"
        ? {
            ...r,
            ...(r.field === id
              ? {
                  perUnit: r.perUnit / ratio,
                  minUnits: value(r.minUnits),
                  maxUnits: value(r.maxUnits),
                }
              : {}),
            when: r.when?.map(condition),
          }
        : r.kind === "conditional"
          ? { ...r, when: r.when.map(condition) }
          : r,
    ),
  };
}
export function measurementSystem(template: QuoteTemplate, system: "metric" | "imperial") {
  let result = template;
  const pairs: Partial<Record<Unit, Unit>> =
    system === "metric"
      ? { ft2: "m2", ft: "m", mi: "km", yd3: "m3", lb: "kg" }
      : { m2: "ft2", cm2: "ft2", m: "ft", cm: "ft", km: "mi", m3: "yd3", kg: "lb" };
  for (const q of template.questions) {
    const unit = inferredUnit(q);
    if (unit && pairs[unit]) result = convertQuestionUnit(result, q.id, pairs[unit]!);
  }
  return result;
}
