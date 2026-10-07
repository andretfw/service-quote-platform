import { Text } from "@/components/Language";
import AppShell from "@/components/AppShell";
import { prepareTemplate } from "@/lib/localization";
import { uiLocale } from "@/lib/server/locale";
import { notFound } from "next/navigation";
import TemplateBuilder from "@/components/TemplateBuilder";
import { getAppUrl } from "@/lib/server/env";
import { pageWorkspace } from "@/lib/server/page-workspace";
import { quoteTemplateSchema } from "@/lib/server/schemas";
import { getTemplate } from "@/lib/templates";

export const dynamic = "force-dynamic";

export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await pageWorkspace();
  let template = getTemplate(id);
  let existing;
  if (!template) {
    const { data: calculator, error } = await workspace.db
      .from("calculators")
      .select("id,name,public_id,template_slug,active_version")
      .eq("id", id)
      .eq("organization_id", workspace.organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!calculator) notFound();
    const { data: version, error: versionError } = await workspace.db
      .from("calculator_versions")
      .select("schema,pricing_rules")
      .eq("calculator_id", id)
      .eq("version", calculator.active_version)
      .single();
    if (versionError) throw versionError;
    template = quoteTemplateSchema.parse({
      ...(version.schema as Record<string, unknown>),
      name: calculator.name,
      slug: calculator.template_slug,
      rules: version.pricing_rules,
    });
    existing = { id, publicId: calculator.public_id, version: calculator.active_version };
  }

  if (!existing) template = prepareTemplate(template, await uiLocale());
  const appOrigin = getAppUrl("http://localhost:3000");

  return (
    <AppShell>
      <main className="shell app-page">
        <h1>
          <Text>{"Customize"}</Text> <Text>{template.name}</Text>
        </h1>
        <p className="muted">
          <Text>{"Edit pricing and preview the customer experience side by side."}</Text>
        </p>
        <TemplateBuilder
          initial={template}
          appOrigin={appOrigin}
          plan={workspace.plan}
          existing={existing}
        />
      </main>
    </AppShell>
  );
}
