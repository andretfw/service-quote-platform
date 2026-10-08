"use client";
import BrandLogo from "@/components/BrandLogo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LanguageSelect, useLanguage } from "./Language";
const items = [
  ["/dashboard", "Dashboard", "◫"],
  ["/leads", "Lead pipeline", "↗"],
  ["/workspace", "My calculators", "▦"],
  ["/bookings", "Booking requests", "▤"],
  ["/connections", "Connections", "⇄"],
  ["/help", "Help", "?"],
  ["/billing", "Subscription", "◇"],
];
export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  return (
    <div className="app-layout">
      <aside className={`app-sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-header">
          <Link className="brand" href="/dashboard">
            <BrandLogo />
          </Link>
          <button
            className="btn secondary menu-toggle"
            type="button"
            aria-expanded={open}
            aria-controls="workspace-navigation"
            onClick={() => setOpen(!open)}
          >
            {t(open ? "Close menu" : "Menu")}
          </button>
        </div>
        <span className="sidebar-caption">{t("Your business")}</span>
        <nav id="workspace-navigation" aria-label={t("Your business")}>
          {items.map(([href, label, icon]) => (
            <Link
              key={href}
              onClick={() => setOpen(false)}
              aria-current={path === href || path.startsWith(`${href}/`) ? "page" : undefined}
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
          <Link href="/calculators" onClick={() => setOpen(false)}>
            {t("Templates")} →
          </Link>
        </div>
      </aside>
      <div className="app-content">{children}</div>
    </div>
  );
}
