import PublicFrame from "@/components/PublicFrame";
import { Text } from "@/components/Language";
import PlanCards from "@/components/PlanCards";
import Faq from "@/components/Faq";
export default function PricingPage() {
  return (
    <PublicFrame>
      <div className="page-intro">
        <span className="eyebrow">
          <Text>Room to grow</Text>
        </span>
        <h1>
          <Text>Simple plans for real service businesses.</Text>
        </h1>
        <p>
          <Text>
            Start free. Get more calculators as you grow. Choose branding and automation when they
            help your business.
          </Text>
        </p>
      </div>
      <PlanCards />
      <p className="pricing-notes muted">
        <Text>
          Prices are in EUR and billed monthly. Lead allowances reset on the first day of each month
          in UTC. Unused allowances do not roll over. Stripe payment processing fees are separate.
          Booking requests require business confirmation.
        </Text>
      </p>
      <section className="public-section">
        <div className="section-intro">
          <h2>
            <Text>Questions before you choose?</Text>
          </h2>
        </div>
        <Faq />
      </section>
    </PublicFrame>
  );
}
