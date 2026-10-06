import Link from "next/link";
import { templates } from "@/lib/templates";

export default function CalculatorsPage() {
  return (
    <main className="shell">
      <div className="nav">
        <Link className="brand" href="/">
          Service Quote
        </Link>
        <Link className="btn" href="/dashboard">
          Dashboard
        </Link>
      </div>

      <h1>Industry templates</h1>
      <p className="muted">
        Every template uses the same deterministic pricing engine, so new verticals are configuration
        rather than separate codebases.
      </p>

      <div className="grid">
        {templates.map((template) => (
          <div className="card" key={template.slug}>
            <span className="pill">{template.industry}</span>
            <h3>{template.name}</h3>
            <p className="muted">{template.description}</p>
            <div className="row">
              <Link className="btn secondary" href={`/q/${template.slug}`}>
                Preview
              </Link>
              <Link className="btn" href={`/builder/${template.slug}`}>
                Customize
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
