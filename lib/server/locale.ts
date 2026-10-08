import "server-only";
import { cookies, headers } from "next/headers";
import { locales, preferredLocale, validLocale, type Locale } from "@/lib/i18n";
export async function uiLocale() {
  const cookie = (await cookies()).get("sq_locale")?.value;
  return locales.includes(cookie as Locale)
    ? validLocale(cookie)
    : preferredLocale((await headers()).get("accept-language"));
}
