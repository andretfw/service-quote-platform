import { planIds, plans } from "@/lib/plans";
import ActionButton from "./ActionButton";

export default function PlanCards({
  checkout = false,
  configured = false,
}: {
  checkout?: boolean;
  configured?: boolean;
}) {
  return (
    <div className="grid">
      {planIds.map((id) => {
        const plan = plans[id];
        return (
          <div className="card" key={id}>
            <span className="pill">{plan.name}</span>
            <h2>
              {plan.monthlyEur === null ? (
                "Pricing coming soon"
              ) : (
                <>
                  €{plan.monthlyEur}
                  <small className="muted"> / month</small>
                </>
              )}
            </h2>
            <ul className="feature-list">
              <li>
                {plan.calculators} {plan.calculators === 1 ? "calculator" : "calculators"}
              </li>
              <li>{plan.monthlyLeads.toLocaleString("en")} enquiries per calendar month</li>
              <li>All 15 templates and customizable pricing editor</li>
              <li>Website embeds and hosted links</li>
              <li>Lead dashboard and configurable tax rate</li>
              {plan.branding && <li>Business logo, name, brand colour and CSV exports</li>}
              {plan.followUps && <li>Optional email follow-ups (email setup required)</li>}
              {plan.bookings && <li>Booking requests with business confirmation</li>}
              {plan.deposits && (
                <li>Customer job deposits into your Stripe account (Stripe setup required)</li>
              )}
            </ul>
            {checkout ? (
              <ActionButton
                endpoint="/api/billing/checkout"
                body={{ plan: id }}
                disabled={!configured}
              >
                Choose {plan.name}
              </ActionButton>
            ) : (
              <a className="btn" href="/billing">
                Choose {plan.name}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
