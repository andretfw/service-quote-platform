import PublicFrame from "@/components/PublicFrame";
import Faq from "@/components/Faq";
import { Text } from "@/components/Language";
import Link from "next/link";
const guides = [
  [
    "Choose a template",
    "Find your service and try its demo. Open Customize to create your own version.",
    "/templates",
    "Browse templates",
  ],
  [
    "Set your prices",
    "Work through the five editor steps. Set units and currency, edit questions and rates, then test small and large jobs in the preview.",
    "/workspace",
    "My calculators",
  ],
  [
    "Publish and share",
    "Save your calculator. Copy its public link or embed code from the Share panel. Open the link on your phone before sending it to customers.",
    "/workspace",
    "Open workspace",
  ],
  [
    "Respond to enquiries",
    "Open the lead dashboard to see the customer's answers and estimate. Contact them to confirm scope, availability and the final price.",
    "/leads",
    "Lead pipeline",
  ],
] as const;
export default function HelpPage() {
  return (
    <PublicFrame>
      <div className="page-intro">
        <span className="eyebrow">
          <Text>Getting started</Text>
        </span>
        <h1>
          <Text>Your first calculator, step by step.</Text>
        </h1>
        <p>
          <Text>
            Start small: one service, your real prices and a test enquiry before you share it.
          </Text>
        </p>
      </div>
      <div className="guide-grid">
        {guides.map(([title, body, href, cta], i) => (
          <article className="card" key={title}>
            <span className="step-number">{i + 1}</span>
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
      <section className="public-section" id="faq">
        <div className="section-intro">
          <h2>
            <Text>Frequently asked questions</Text>
          </h2>
          <p>
            <Text>Clear answers about setup, plans and what your customers see.</Text>
          </p>
        </div>
        <Faq />
      </section>
    </PublicFrame>
  );
}
