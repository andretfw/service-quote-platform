import { Text } from "@/components/Language";
import AppShell from "@/components/AppShell";
import TemplateGallery from "@/components/TemplateGallery";
export default function CalculatorsPage() {
  return (
    <AppShell>
      <main className="shell app-page">
        <h1>
          <Text>Industry templates</Text>
        </h1>
        <p className="muted">
          <Text>Choose your trade. Add your prices. Start receiving enquiries.</Text>
        </p>
        <TemplateGallery />
      </main>
    </AppShell>
  );
}
