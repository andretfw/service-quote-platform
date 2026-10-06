import { notFound } from "next/navigation";
import QuoteWidget from "@/components/QuoteWidget";
import { resolveCalculator, toPublicQuoteConfig } from "@/lib/server/calculator-resolver";

export default async function EmbedPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const resolved = await resolveCalculator(publicId);
  if (!resolved) notFound();

  return (
    <main style={{ padding: 12 }}>
      <QuoteWidget config={toPublicQuoteConfig(resolved)} compact />
    </main>
  );
}
