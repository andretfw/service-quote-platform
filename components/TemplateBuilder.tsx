"use client";

import { useEffect, useMemo, useState } from "react";
import QuoteWidget from "./QuoteWidget";
import type { PublicQuoteConfig, QuoteTemplate } from "@/lib/types";

type SavedCalculator = {
  id: string;
  publicId: string;
};

export default function TemplateBuilder({ initial }: { initial: QuoteTemplate }) {
  const [basePrice, setBasePrice] = useState(
    () => initial.rules.find((rule) => rule.kind === "base")?.amount ?? 0,
  );
  const [rangePercent, setRangePercent] = useState(initial.rangePct ?? 0.08);
  const [origin, setOrigin] = useState("https://your-domain.example");
  const [saved, setSaved] = useState<SavedCalculator | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const template = useMemo<QuoteTemplate>(
    () => ({
      ...initial,
      rangePct: rangePercent,
      rules: initial.rules.map((rule) =>
        rule.kind === "base" ? { ...rule, amount: basePrice } : rule,
      ),
    }),
    [initial, basePrice, rangePercent],
  );

  const previewConfig = useMemo<PublicQuoteConfig>(
    () => ({
      publicId: initial.slug,
      name: template.name,
      industry: template.industry,
      description: template.description,
      currency: template.currency,
      questions: template.questions,
      canCaptureLeads: false,
    }),
    [initial.slug, template],
  );

  const publicId = saved?.publicId ?? initial.slug;
  const embed = `<script async src="${origin}/embed.js" data-service-quote="${publicId}"></script>`;

  const save = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/calculators", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const data = (await response.json()) as SavedCalculator & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save calculator");
      setSaved(data);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save calculator");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="builder">
      <div className="card">
        <h2>Pricing setup</h2>
        <label htmlFor="base-price">Base price</label>
        <input
          id="base-price"
          className="field"
          type="number"
          min="0"
          value={basePrice}
          onChange={(event) => setBasePrice(Math.max(0, Number(event.target.value)))}
        />

        <label className="stacked-label" htmlFor="estimate-range">
          Estimate range ± {(rangePercent * 100).toFixed(0)}%
        </label>
        <input
          id="estimate-range"
          className="field"
          type="range"
          min="0"
          max="0.25"
          step="0.01"
          value={rangePercent}
          onChange={(event) => setRangePercent(Number(event.target.value))}
        />

        <div className="action-row">
          <button className="btn" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : saved ? "Create another calculator" : "Create calculator"}
          </button>
        </div>
        {saveError && <p className="error-message">{saveError}</p>}
        {saved && (
          <p className="success-panel">
            Created. Public URL: <a href={`/q/${saved.publicId}`}>/q/{saved.publicId}</a>
          </p>
        )}

        <h3>Embed code</h3>
        <pre className="code">{embed}</pre>
        <p className="muted">
          The public widget receives question configuration only. Pricing rules stay server-side.
        </p>
      </div>
      <div>
        <QuoteWidget config={previewConfig} compact previewTemplate={template} />
      </div>
    </div>
  );
}
