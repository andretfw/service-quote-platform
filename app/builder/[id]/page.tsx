import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import TemplateBuilder from "@/components/TemplateBuilder";
import { publicSupabaseConfigured } from "@/lib/server/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/templates";

export const dynamic = "force-dynamic";

export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = getTemplate(id);
  if (!template) notFound();

  if (!publicSupabaseConfigured()) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  return (
    <main className="shell">
      <div className="nav">
        <Link className="brand" href="/">
          Service Quote
        </Link>
        <Link href="/calculators">Templates</Link>
      </div>
      <h1>Customize {template.name}</h1>
      <p className="muted">Edit pricing and preview the customer experience side by side.</p>
      <TemplateBuilder initial={template} />
    </main>
  );
}
