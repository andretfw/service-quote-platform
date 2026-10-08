"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "./BrandLogo";
import { LanguageSelect, useLanguage } from "./Language";

const links = [
  ["/#product", "Product"],
  ["/templates", "Templates"],
  ["/integrations", "Integrations"],
  ["/pricing", "Pricing"],
  ["/help", "Help"],
];
export default function PublicFrame({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="public-site">
      <a className="skip-link" href="#main-content">
        {t("Skip to content")}
      </a>
      <header className="public-header shell">
        <Link className="brand" href="/">
          <BrandLogo />
        </Link>
        <button
          className="btn secondary menu-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="public-navigation"
          onClick={() => setOpen(!open)}
        >
          {t(open ? "Close menu" : "Menu")}
        </button>
        <nav
          id="public-navigation"
          className={`public-navigation ${open ? "is-open" : ""}`}
          aria-label={t("Main navigation")}
        >
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {t(label)}
            </Link>
          ))}
          <LanguageSelect />
          <Link href="/login" onClick={() => setOpen(false)}>
            {t("Sign in")}
          </Link>
          <Link className="btn" href="/login" onClick={() => setOpen(false)}>
            {t("Start free")}
          </Link>
        </nav>
      </header>
      <main id="main-content" className="shell public-main">
        {children}
      </main>
      <footer className="public-footer shell">
        <div>
          <BrandLogo />
          <p>{t("Simple estimates. Better conversations.")}</p>
        </div>
        <nav aria-label={t("Footer navigation")}>
          {links.slice(1).map(([href, label]) => (
            <Link key={href} href={href}>
              {t(label)}
            </Link>
          ))}
        </nav>
        <p className="small muted">
          {t(
            "Estimates help start a conversation. Your business confirms the final scope and price.",
          )}
        </p>
      </footer>
    </div>
  );
}
