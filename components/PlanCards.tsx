"use client";
import { planIds, plans } from "@/lib/plans";
import ActionButton from "./ActionButton";
import { useLanguage } from "./Language";
export default function PlanCards({
  checkout = false,
  configured = false,
}: {
  checkout?: boolean;
  configured?: boolean;
}) {
  const { t, locale } = useLanguage();
  const descriptions = [
    "For independent businesses getting started",
    "For growing businesses building their brand",
    "For businesses managing bookings and deposits",
  ];
  return (
    <div className="plan-grid">
      {planIds.map((id, index) => {
        const plan = plans[id];
        const features = [
          "All 15 templates",
          "English, Spanish and Romanian",
          "Metric and imperial units",
          "Website embeds and hosted links",
          "Lead dashboard and configurable tax rate",
          ...(plan.branding ? ["Business logo, name and colour", "CSV exports"] : []),
          ...(plan.followUps ? ["Optional customer reminders"] : []),
          ...(plan.bookings ? ["Booking requests with business confirmation"] : []),
          ...(plan.deposits ? ["Deposits through your connected Stripe account"] : []),
        ];
        return (
          <section className={`card plan-card ${id === "premium" ? "featured" : ""}`} key={id}>
            {id === "premium" && <span className="plan-badge">{t("More customization")}</span>}
            <span className="eyebrow">{plan.name}</span>
            <p className="plan-description">{t(descriptions[index])}</p>
            <div className="plan-price">
              {plan.monthlyEur === null ? (
                <span>{t("Pricing coming soon")}</span>
              ) : (
                <>
                  <strong>€{plan.monthlyEur}</strong>
                  <span>{t("/ month")}</span>
                </>
              )}
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
            {checkout ? (
              <ActionButton
                endpoint="/api/billing/checkout"
                body={{ plan: id }}
                disabled={!configured}
              >
                {t("Choose")} {plan.name}
              </ActionButton>
            ) : (
              <a className="btn" href="/billing">
                {t("Choose")} {plan.name}
              </a>
            )}
          </section>
        );
      })}
    </div>
  );
}
