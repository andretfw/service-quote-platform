import BrandLogo from "@/components/BrandLogo";
import { Text } from "@/components/Language";
import Link from "next/link";
import PlanCards from "@/components/PlanCards";

export default function PricingPage() {
  return (
    <main className="shell">
      <nav className="nav">
        <Link className="brand" href="/">
          <BrandLogo />
        </Link>
        <Link href="/login">
          <Text>{"Sign in"}</Text>
        </Link>
      </nav>
      <h1>
        <Text>{"Choose the plan that fits your business."}</Text>
      </h1>
      <p className="muted">
        <Text>
          {
            "Start free with one calculator and seven enquiries per month. No card required. Upgrade when you need more calculators or features."
          }
        </Text>
      </p>
      <PlanCards />
      <p className="muted">
        <Text>
          {
            "Subscription pricing will be announced before paid plans become available. Lead allowances reset on the first day of each month in UTC. Unused allowances do not roll over. Stripe payment processing fees are separate. Booking requests require business confirmation."
          }
        </Text>
      </p>
    </main>
  );
}
