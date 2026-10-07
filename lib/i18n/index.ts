import messages from "./messages.json";
export const locales = ["en", "es", "ro"] as const;
export type Locale = (typeof locales)[number];
export const languageNames = { en: "English", es: "Español", ro: "Română" };
export const validLocale = (value: unknown): Locale =>
  locales.includes(value as Locale) ? (value as Locale) : "en";
export function translate(
  source: string,
  locale: Locale,
  values?: Record<string, string | number>,
) {
  const entry = (messages as Record<string, { es: string; ro: string }>)[source];
  let result = locale === "en" ? source : (entry?.[locale] ?? source);
  for (const [key, value] of Object.entries(values ?? {}))
    result = result.replaceAll(`{${key}}`, String(value));
  return result;
}
export function preferredLocale(header: string | null): Locale {
  const choices = (header ?? "")
    .split(",")
    .map((entry) => {
      const [tag, ...params] = entry.trim().split(";");
      const quality = params.find((param) => param.trim().startsWith("q="));
      return {
        locale: tag.toLowerCase().split("-")[0],
        weight: quality ? Number(quality.trim().slice(2)) : 1,
      };
    })
    .filter(
      (entry) => locales.includes(entry.locale as Locale) && entry.weight > 0 && entry.weight <= 1,
    )
    .sort((left, right) => right.weight - left.weight);
  return validLocale(choices[0]?.locale);
}
