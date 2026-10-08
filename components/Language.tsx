"use client";
import { createContext, useContext, type ReactNode } from "react";
import { languageNames, locales, translate, validLocale, type Locale } from "@/lib/i18n";
const LanguageContext = createContext<Locale>("en");
export function LanguageProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LanguageContext.Provider value={locale}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const locale = useContext(LanguageContext);
  return {
    locale,
    t: (source: string, values?: Record<string, string | number>) =>
      translate(source, locale, values),
  };
}
export function Text({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  return <>{typeof children === "string" ? t(children) : children}</>;
}
export function LanguageSelect({
  value,
  onChange,
  available = locales,
}: {
  value?: Locale;
  available?: readonly Locale[];
  onChange?: (locale: Locale) => void;
}) {
  const { locale, t } = useLanguage();
  return (
    <select
      className="language-select"
      aria-label={t("Language")}
      value={value ?? locale}
      onChange={(e) => {
        const next = validLocale(e.target.value);
        if (onChange) onChange(next);
        else {
          document.cookie = `sq_locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
          window.location.reload();
        }
      }}
    >
      {available.map((lang) => (
        <option key={lang} value={lang}>
          {languageNames[lang]}
        </option>
      ))}
    </select>
  );
}
export function LocalizedInput(props: React.ComponentProps<"input">) {
  const { t } = useLanguage();
  return (
    <input
      {...props}
      placeholder={props.placeholder ? t(props.placeholder) : undefined}
      aria-label={props["aria-label"] ? t(props["aria-label"]) : undefined}
    />
  );
}
