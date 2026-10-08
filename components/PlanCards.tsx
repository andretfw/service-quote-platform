"use client";
import { planIds, plans, type PlanId } from "@/lib/plans";
import ActionButton from "./ActionButton";
import { useLanguage } from "./Language";
export default function PlanCards({
  checkout = false,
  configured = false,
  currentPlan,
}: {
  checkout?: boolean;
  configured?: boolean;
  currentPlan?: PlanId;
}) {
  const { t, locale } = useLanguage();
  const descriptions: Record<PlanId, string> = {
    free: "Try it with real customers, free forever",
    basic: "For independent businesses getting started",
    premium: "For growing businesses building their brand",
    business: "For businesses managing bookings and deposits",
  };
  return (
    <>
      <div className="plan-grid">
        {planIds.map((id) => {
          const plan = plans[id];
          const features = [
            ...(id === "free"
              ? [
                  "Website embeds and hosted links",
                  "Lead dashboard",
                  "Service Quote logo on your calculator",
                ]
              : []),
            ...(id === "basic" ? ["Everything in Free", "No Service Quote branding"] : []),
            ...(id === "premium"
              ? [
                  "Everything in Basic",
                  "Business logo, name and colour",
                  "CSV exports",
                  "Optional customer reminders",
                  "Zapier and Make connections",
                ]
              : []),
            ...(id === "business"
              ? [
                  "Everything in Premium",
                  "Booking requests with business confirmation",
                  "Internal booking calendar and availability",
                  "Google Calendar and Outlook connections (setup required)",
                  "Deposits through your connected Stripe account",
                ]
              : []),
          ];
          return (
            <section className={`card plan-card ${id === "premium" ? "featured" : ""}`} key={id}>
              {id === "premium" && <span className="plan-badge">{t("More customization")}</span>}
              <span className="eyebrow">{t(plan.name)}</span>
              <p className="plan-description">{t(descriptions[id])}</p>
              <div className="plan-price">
                <strong>€{plan.monthlyEur}</strong>
                <span>{t("/ month")}</span>
              </div>
              <div className="plan-allowance">
                <strong>
                  {plan.calculators} {t(plan.calculators === 1 ? "calculator" : "calculators")}
                </strong>
                <span>
                  {plan.monthlyLeads.toLocaleString(locale)} {t("enquiries per calendar month")}
                </span>
              </div>
              <ul className="feature-list">
                {features.map((feature) => (
                  <li key={feature}>
                    <span aria-hidden="true">✓</span>
                    {t(feature)}
                  </li>
                ))}
              </ul>
              {id === "free" ? (
                currentPlan === "free" ? (
                  <button className="btn secondary" disabled>
                    {t("Current plan")}
                  </button>
                ) : checkout ? (
                  <a className="btn secondary" href="#billing-management">
                    {t("Manage subscription to switch")}
                  </a>
                ) : (
                  <a className="btn secondary" href="/login">
                    {t("Start free")}
                  </a>
                )
              ) : currentPlan === id ? (
                <button className="btn secondary" disabled>
                  {t("Current plan")}
                </button>
              ) : checkout ? (
                <ActionButton
                  endpoint="/api/billing/checkout"
                  body={{ plan: id }}
                  disabled={!configured}
                >
                  {t("Choose")} {plan.name}
                </ActionButton>
              ) : (
                <a className="btn" href="/login">
                  {t("Choose")} {plan.name}
                </a>
              )}
            </section>
          );
        })}
      </div>
      <section className="plans-common">
        <h2>{t("Included in every plan")}</h2>
        <ul>
          {[
            "All 15 templates",
            "English, Spanish and Romanian",
            "Metric and imperial units",
            "Custom questions, rates and estimate tax",
          ].map((feature) => (
            <li key={feature}>✓ {t(feature)}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
