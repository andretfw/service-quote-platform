import Link from "next/link";
import { templates } from "@/lib/templates";

export default function Home() {
  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand">Service Quote</div>
        <div className="row">
          <Link href="/calculators">Templates</Link>
          <Link className="btn" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div>
          <span className="pill">Quote → Qualify → Follow up → Book → Pay</span>
          <h1>Turn your website into a quoting machine.</h1>
          <p>
            Launch an industry-ready instant quote flow, capture qualified leads and turn estimates
            into booked work.
          </p>
          <div className="row" style={{ justifyContent: "flex-start" }}>
            <Link className="btn" href="/q/painting">
              Try painting demo
            </Link>
            <Link className="btn secondary" href="/calculators">
              Browse 15 templates
            </Link>
          </div>
        </div>

        <div className="card">
          <h3>Built for service businesses</h3>
          <p className="muted">
            No formula language and no CRM migration. Pick an industry, adjust pricing and embed the
            flow into a website.
          </p>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {templates.slice(0, 6).map((template) => (
              <Link className="option" key={template.slug} href={`/q/${template.slug}`}>
                {template.industry}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2>Ready-made flows</h2>
        <div className="grid">
          {templates.map((template) => (
            <Link className="card" key={template.slug} href={`/q/${template.slug}`}>
              <span className="pill">{template.industry}</span>
              <h3>{template.name}</h3>
              <p className="muted">{template.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
