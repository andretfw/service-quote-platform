import { notFound } from "next/navigation";
import QuoteWidget from "@/components/QuoteWidget";
import { resolveCalculator, toPublicQuoteConfig } from "@/lib/server/calculator-resolver";

export default async function QuotePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const resolved = await resolveCalculator(publicId);
  if (!resolved) notFound();

  return (
    <main className="shell">
      <div className="quote">
        <QuoteWidget config={toPublicQuoteConfig(resolved)} />
      </div>
    </main>
  );
}
