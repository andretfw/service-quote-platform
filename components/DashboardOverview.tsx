"use client";
import Link from "next/link";
import { useLanguage } from "./Language";
import { formatEstimate } from "@/lib/lead-summary";
import { templates } from "@/lib/templates";
import { translate } from "@/lib/i18n";

type Lead = {
  id: string;
  lead_name: string;
  template_slug: string;
  quote: unknown;
  status: string;
};
export default function DashboardOverview({ leads }: { leads: Lead[] }) {
  const { locale, t } = useLanguage();
  const booked = leads.filter((lead) => ["booked", "won"].includes(lead.status)).length;
  const totals = new Map<string, number>();
  for (const lead of leads) {
    if (!lead.quote || typeof lead.quote !== "object") continue;
    const quote = lead.quote as Record<string, unknown>;
    if (
      typeof quote.currency === "string" &&
      typeof quote.subtotal === "number" &&
      Number.isFinite(quote.subtotal)
    )
      totals.set(quote.currency, (totals.get(quote.currency) ?? 0) + quote.subtotal);
  }
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 })
      .format(amount)
      .replace(/[\u00a0\u202f]/g, " ");
  const totalEntries = [...totals.entries()];
  const stats = [
    {
      label: "New enquiries",
      value: String(leads.filter((lead) => lead.status === "new").length),
      detail: "Recent 100 enquiries",
    },
    {
      label: "Estimated opportunities",
      value: totalEntries.length === 1 ? money(totalEntries[0][1], totalEntries[0][0]) : "—",
      detail:
        totalEntries.length > 1
          ? totalEntries.map(([currency, amount]) => money(amount, currency)).join(" · ")
          : "Recent 100 enquiries",
    },
    { label: "Booked / won", value: String(booked), detail: "Current pipeline" },
    {
      label: "Conversion",
      value: `${(leads.length ? (booked / leads.length) * 100 : 0).toLocaleString(locale, { maximumFractionDigits: 1 })}%`,
      detail: "Booked or won / leads",
    },
  ];
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Service Quote</span>
          <h1>{t("Dashboard")}</h1>
          <p className="muted">
            {t("Review new enquiries, contact customers and keep your pipeline up to date.")}
          </p>
        </div>
        <Link className="btn" href="/calculators">
          + {t("New calculator")}
        </Link>
      </div>
      {!leads.length && (
        <div className="card welcome-card">
          <span className="eyebrow">{t("Your next steps")}</span>
          <h2>{t("Start receiving quote requests")}</h2>
          <p className="muted">
            {t(
              "Choose an industry template, enter your prices and save your calculator. Share its link with customers or add it to your website. Customer requests appear here and in your leads list.",
            )}
          </p>
          <Link className="btn" href="/calculators">
            {t("Create your first calculator")}
          </Link>
        </div>
      )}
      <div className="stat-grid">
        {stats.map((stat) => (
          <div className="card stat-card" key={stat.label}>
            <span className="stat-label">{t(stat.label)}</span>
            <div className="stat-value">{stat.value}</div>
            <span className="small muted">{t(stat.detail)}</span>
          </div>
        ))}
      </div>
      <p className="small muted">
        {t("Estimated value is not revenue. Figures below cover the latest 100 enquiries.")}
      </p>
      <section className="card table-card">
        <div className="section-heading">
          <h2>{t("Recent leads")}</h2>
          <Link className="text-button" href="/leads">
            {t("View all")} →
          </Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {["Lead", "Template", "Estimate", "Status"].map((label) => (
                  <th key={label}>{t(label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 8).map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <Link className="lead-name" href={`/leads/${lead.id}`}>
                      {lead.lead_name}
                    </Link>
                  </td>
                  <td>
                    {translate(
                      templates.find((template) => template.slug === lead.template_slug)
                        ?.industry ?? "Custom",
                      locale,
                    )}
                  </td>
                  <td>{formatEstimate(lead.quote, locale)}</td>
                  <td>
                    <span className={`status-badge status-${lead.status}`}>{t(lead.status)}</span>
                  </td>
                </tr>
              ))}
              {!leads.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    {t("No leads yet.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
