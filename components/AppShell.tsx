"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LanguageSelect, useLanguage } from "./Language";
const items = [
  ["/dashboard", "Dashboard", "◫"],
  ["/leads", "Lead pipeline", "↗"],
  ["/workspace", "My calculators", "▦"],
  ["/bookings", "Booking requests", "▤"],
  ["/billing", "Subscription", "◇"],
];
export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { t } = useLanguage();
  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <Link className="brand" href="/dashboard">
          <span className="brand-icon">S</span> Service Quote
        </Link>
        <span className="sidebar-caption">{t("Your business")}</span>
        <nav aria-label={t("Your business")}>
          {items.map(([href, label, icon]) => (
            <Link
              key={href}
              className={`sidebar-link ${path === href || path.startsWith(`${href}/`) ? "active" : ""}`}
              href={href}
            >
              <span aria-hidden="true">{icon}</span>
              {t(label)}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <LanguageSelect />
          <Link href="/calculators">{t("Templates")} →</Link>
        </div>
      </aside>
      <div className="app-content">{children}</div>
    </div>
  );
}
