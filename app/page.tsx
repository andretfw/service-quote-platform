import BrandLogo from "@/components/BrandLogo";
import { Text } from "@/components/Language";
import Link from "next/link";
import { templates } from "@/lib/templates";

export default function Home() {
  return (
    <main className="shell">
      <nav className="nav">
        <Link className="brand" href="/">
          <BrandLogo />
        </Link>
        <div className="row">
          <Link href="/pricing">
            <Text>{"Pricing"}</Text>
          </Link>
          <Link href="/calculators">
            <Text>{"Templates"}</Text>
          </Link>
          <Link className="btn" href="/dashboard">
            <Text>{"Dashboard"}</Text>
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div>
          <span className="pill">
            <Text>{"Quote → Qualify → Follow up → Book → Pay"}</Text>
          </span>
          <h1>
            <Text>{"Turn your website into a quoting machine."}</Text>
          </h1>
          <p>
            <Text>
              {
                "Launch an industry-ready instant quote flow, capture qualified leads and turn estimates into booked work."
              }
            </Text>
          </p>
          <div className="row" style={{ justifyContent: "flex-start" }}>
            <Link className="btn" href="/q/painting">
              <Text>{"Try painting demo"}</Text>
            </Link>
            <Link className="btn secondary" href="/calculators">
              <Text>{"Browse 15 templates"}</Text>
            </Link>
          </div>
        </div>

        <div className="card">
          <h3>
            <Text>{"Built for service businesses"}</Text>
          </h3>
          <p className="muted">
            <Text>
              {
                "No formula language and no CRM migration. Pick an industry, adjust pricing and embed the flow into a website."
              }
            </Text>
          </p>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {templates.slice(0, 6).map((template) => (
              <Link className="option" key={template.slug} href={`/q/${template.slug}`}>
                <Text>{template.industry}</Text>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2>
          <Text>{"Ready-made flows"}</Text>
        </h2>
        <div className="grid">
          {templates.map((template) => (
            <Link className="card" key={template.slug} href={`/q/${template.slug}`}>
              <span className="pill">
                <Text>{template.industry}</Text>
              </span>
              <h3>
                <Text>{template.name}</Text>
              </h3>
              <p className="muted">
                <Text>{template.description}</Text>
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
