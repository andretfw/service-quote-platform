import { Text } from "@/components/Language";
import AppShell from "@/components/AppShell";
import Link from "next/link";
import { templates } from "@/lib/templates";

export default function CalculatorsPage() {
  return (
    <AppShell>
      <main className="shell app-page">
        <h1>
          <Text>{"Industry templates"}</Text>
        </h1>
        <p className="muted">
          <Text>{"Choose your trade. Add your prices. Start receiving enquiries."}</Text>
        </p>

        <div className="grid">
          {templates.map((template) => (
            <div className="card" key={template.slug}>
              <span className="pill">
                <Text>{template.industry}</Text>
              </span>
              <h3>
                <Text>{template.name}</Text>
              </h3>
              <p className="muted">
                <Text>{template.description}</Text>
              </p>
              <div className="row">
                <Link className="btn secondary" href={`/q/${template.slug}`}>
                  <Text>{"Preview"}</Text>
                </Link>
                <Link className="btn" href={`/builder/${template.slug}`}>
                  <Text>{"Customize"}</Text>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
