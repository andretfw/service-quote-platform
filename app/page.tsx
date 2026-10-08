import PublicFrame from "@/components/PublicFrame";
import { Text } from "@/components/Language";
import Faq from "@/components/Faq";
import ProductDemo from "@/components/ProductDemo";
import Link from "next/link";
import { templates } from "@/lib/templates";
import { prepareTemplate } from "@/lib/localization";
import { toPublicQuoteConfig } from "@/lib/server/calculator-resolver";
const benefits = [
  [
    "Your services, your prices",
    "Start with a trade template. Adjust questions, measurements, rates and extras in a guided editor.",
  ],
  [
    "An estimate before a conversation",
    "Customers answer a few questions and see a price range. You receive their request and confirm the final details.",
  ],
  [
    "Every enquiry in one place",
    "Review answers, track lead status and respond from your dashboard. Add reminders or booking requests when you need them.",
  ],
] as const;
export default function Home() {
  const template = prepareTemplate(templates[0], "en");
  const config = toPublicQuoteConfig({ publicId: template.slug, calculatorId: null, template });
  return (
    <PublicFrame>
      <section className="hero public-hero">
        <div>
          <span className="pill">
            <Text>For independent service businesses</Text>
          </span>
          <h1>
            <Text>Less back-and-forth. More ready-to-talk customers.</Text>
          </h1>
          <p>
            <Text>
              Give customers an instant estimate based on your prices, collect the job details and
              follow every enquiry in one simple workspace.
            </Text>
          </p>
          <div className="hero-actions">
            <Link className="btn" href="/login">
              <Text>Create your free calculator</Text>
            </Link>
            <Link className="btn secondary" href="/templates">
              <Text>Explore templates</Text> →
            </Link>
          </div>
          <p className="small muted">
            <Text>No card required · All 15 templates · English, Español, Română</Text>
          </p>
        </div>
        <div className="hero-demo">
          <div className="preview-toolbar">
            <span className="eyebrow">
              <Text>Try the customer experience</Text>
            </span>
            <span className="pill">
              <Text>Working demo</Text>
            </span>
          </div>
          <ProductDemo config={config} />
          <p className="small muted">
            <Text>Demo prices only. Contact details are not saved.</Text>
          </p>
        </div>
      </section>
      <section className="public-section" id="product">
        <div className="section-intro">
          <span className="eyebrow">
            <Text>A clear path from estimate to enquiry</Text>
          </span>
          <h2>
            <Text>Built around the work you already do.</Text>
          </h2>
          <p>
            <Text>
              For painting, cleaning, home improvement and other services where the price depends on
              the job.
            </Text>
          </p>
        </div>
        <div className="grid">
          {benefits.map(([title, body], i) => (
            <article className="benefit" key={title}>
              <span className="step-number">{i + 1}</span>
              <h3>
                <Text>{title}</Text>
              </h3>
              <p className="muted">
                <Text>{body}</Text>
              </p>
            </article>
          ))}
        </div>
      </section>
      <section className="public-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              <Text>Start with your trade</Text>
            </span>
            <h2>
              <Text>Useful templates. Your own rules.</Text>
            </h2>
          </div>
          <Link className="text-link" href="/templates">
            <Text>Browse all 15 templates</Text> →
          </Link>
        </div>
        <div className="grid">
          {templates.slice(0, 6).map((item) => (
            <Link className="card template-link" key={item.slug} href={`/q/${item.slug}`}>
              <span className="pill">
                <Text>{item.industry}</Text>
              </span>
              <h3>
                <Text>{item.name}</Text>
              </h3>
              <p className="muted">
                <Text>{item.description}</Text>
              </p>
              <span className="text-link">
                <Text>Try demo</Text> →
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="public-section integration-explainer">
        <div>
          <span className="eyebrow">
            <Text>Works with your business</Text>
          </span>
          <h2>
            <Text>On your website. In your workflow.</Text>
          </h2>
          <p>
            <Text>
              Use a hosted link or website embed on every plan. Premium and Business add Zapier or
              Make connections for new enquiries. Business adds optional Stripe deposits.
            </Text>
          </p>
          <Link className="text-link" href="/integrations">
            <Text>Explore integrations</Text> →
          </Link>
        </div>
        <div className="card">
          <h3>
            <Text>Make it familiar to your customers.</Text>
          </h3>
          <p>
            <Text>
              Choose metric or imperial units and edit your wording in English, Spanish and
              Romanian. Premium and Business also let you add your logo, business name and colours.
            </Text>
          </p>
          <Link className="text-link" href="/pricing">
            <Text>Compare plans</Text> →
          </Link>
        </div>
      </section>
      <section className="public-section">
        <div className="section-intro">
          <h2>
            <Text>A few things you might be wondering.</Text>
          </h2>
        </div>
        <Faq limit={4} />
        <Link className="text-link" href="/help">
          <Text>All questions and setup guides</Text> →
        </Link>
      </section>
      <section className="public-cta">
        <div>
          <h2>
            <Text>Start with one service. Grow from there.</Text>
          </h2>
          <p>
            <Text>
              One calculator and seven enquiries each month, free. Paid plans start at €9 per month.
            </Text>
          </p>
        </div>
        <Link className="btn" href="/login">
          <Text>Start free</Text> →
        </Link>
      </section>
    </PublicFrame>
  );
}
