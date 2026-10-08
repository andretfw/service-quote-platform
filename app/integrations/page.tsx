import PublicFrame from "@/components/PublicFrame";
import { Text } from "@/components/Language";
import Link from "next/link";
const connections = [
  [
    "Your website",
    "Every plan",
    "Add your calculator to a page that supports script or iframe embeds, or share a hosted link. No website plugin is required.",
    "/help",
    "Read the setup guide",
  ],
  [
    "Zapier & Make",
    "Premium & Business",
    "Send new enquiries to your automation workflow. From there, choose a spreadsheet, CRM or team notification app. One active connection per workspace.",
    "/connections",
    "Set up automation",
  ],
  [
    "Stripe",
    "Business",
    "Connect your business's Stripe account to collect optional customer deposits. Your business completes Stripe verification and receives the payments.",
    "/workspace",
    "Connect Stripe account",
  ],
  [
    "CSV exports",
    "Premium & Business",
    "Download your leads as a spreadsheet and import them into compatible business tools. CSV export is a manual transfer, not an automatic sync.",
    "/leads",
    "Open your leads",
  ],
] as const;
export default function IntegrationsPage() {
  return (
    <PublicFrame>
      <div className="page-intro">
        <span className="eyebrow">
          <Text>Fits your workflow</Text>
        </span>
        <h1>
          <Text>Keep the tools you already use.</Text>
        </h1>
        <p>
          <Text>
            Put your calculator on your website, send enquiries to an automation tool and collect
            deposits with Stripe. Choose only the connections your business needs.
          </Text>
        </p>
      </div>
      <div className="guide-grid">
        {connections.map(([title, plan, body, href, cta]) => (
          <article className="card integration-card" key={title}>
            <span className="pill">
              <Text>{plan}</Text>
            </span>
            <h2>
              <Text>{title}</Text>
            </h2>
            <p className="muted">
              <Text>{body}</Text>
            </p>
            <Link className="text-link" href={href}>
              <Text>{cta}</Text> →
            </Link>
          </article>
        ))}
      </div>
      <section className="public-section integration-explainer">
        <div>
          <span className="eyebrow">
            <Text>New enquiry → your workflow</Text>
          </span>
          <h2>
            <Text>For example: save each enquiry to Google Sheets.</Text>
          </h2>
          <p>
            <Text>
              Create a Catch Hook in Zapier or a custom webhook in Make. Paste that URL into
              Connections, send a sample and map the contact details, answers and estimate to your
              chosen app.
            </Text>
          </p>
        </div>
        <div className="card">
          <h3>
            <Text>What is included?</Text>
          </h3>
          <p>
            <Text>
              New-enquiry delivery, a sample test and delivery status are included on Premium and
              Business. Your business owns its automation account and any separate provider costs.
              Native CRM sync, calendar sync and historical lead imports are not included.
            </Text>
          </p>
          <Link className="btn secondary" href="/connections">
            <Text>Open connections</Text>
          </Link>
        </div>
      </section>
    </PublicFrame>
  );
}
