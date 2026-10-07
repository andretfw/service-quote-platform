import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider, LanguageSelect } from "@/components/Language";
import { uiLocale } from "@/lib/server/locale";

export const metadata: Metadata = {
  title: "Service Quote",
  description: "Instant quotes that turn website visitors into qualified leads.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await uiLocale();
  return (
    <html lang={locale}>
      <body>
        <LanguageProvider locale={locale}>
          <div className="global-language">
            <LanguageSelect />
          </div>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
