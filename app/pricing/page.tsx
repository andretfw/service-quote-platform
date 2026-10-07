import Link from "next/link";
import PlanCards from "@/components/PlanCards";

export default function PricingPage() {
  return (
    <main className="shell">
      <nav className="nav">
        <Link className="brand" href="/">
          Service Quote
        </Link>
        <Link href="/login">Sign in</Link>
      </nav>
      <h1>Choose the plan that fits your business.</h1>
      <p className="muted">
        Start with a 14-day Basic trial. No card required. Upgrade when you need more calculators or
        features.
      </p>
      <PlanCards />
      <p className="muted">
        Subscription pricing will be announced before paid plans become available. Lead allowances
        reset on the first day of each month in UTC. Unused allowances do not roll over. Stripe
        payment processing fees are separate. Booking requests require business confirmation.
      </p>
    </main>
  );
}
