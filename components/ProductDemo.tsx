"use client";
import QuoteWidget from "./QuoteWidget";
import { useLanguage } from "./Language";
import type { PublicQuoteConfig } from "@/lib/types";
export default function ProductDemo({ config }: { config: PublicQuoteConfig }) {
  const { locale } = useLanguage();
  return <QuoteWidget key={locale} config={{ ...config, locale }} compact />;
}
