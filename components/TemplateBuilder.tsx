"use client";
import { useMemo, useState } from "react";
import QuoteWidget from "./QuoteWidget";
import { NumberField, PricingEditor, QuestionEditor } from "./CalculatorFields";
import { plans, type PlanId } from "@/lib/plans";
import type { CalculatorSettings, PublicQuoteConfig, QuoteTemplate, Question } from "@/lib/types";

type SavedCalculator = { id: string; publicId: string; version: number };

export default function TemplateBuilder({
  initial,
  appOrigin,
  plan,
  existing,
}: {
  initial: QuoteTemplate;
  appOrigin: string;
  plan: PlanId | null;
  existing?: SavedCalculator;
}) {
  const [template, setTemplate] = useState<QuoteTemplate>(initial);
  const [saved, setSaved] = useState<SavedCalculator | null>(existing ?? null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newType, setNewType] = useState<Question["type"]>("number");
  const [previewKey, setPreviewKey] = useState(0);
  const features = plan ? plans[plan] : null;
  const settings = template.settings ?? {};
  function changeSettings(patch: Partial<CalculatorSettings>) {
    setTemplate((t) => ({ ...t, settings: { ...t.settings, ...patch } }));
  }
  function updateQuestion(question: Question) {
    setTemplate((t) => ({
      ...t,
      questions: t.questions.map((q) => (q.id === question.id ? question : q)),
    }));
  }
  function updateOptions(question: Question) {
    const values = question.options?.map((o) => o.value) ?? [];
    setTemplate((t) => ({
      ...t,
      questions: t.questions.map((q) =>
        q.id === question.id
          ? question
          : {
              ...q,
              showWhen: q.showWhen?.filter(
                (c) =>
                  c.field !== question.id || c.op === "truthy" || values.includes(String(c.value)),
              ),
            },
      ),
      rules: t.rules
        .filter(
          (rule) =>
            !(
              rule.kind === "conditional" &&
              rule.when.some(
                (c) =>
                  c.field === question.id && c.op !== "truthy" && !values.includes(String(c.value)),
              )
            ),
        )
        .map((rule) =>
          "field" in rule && rule.field === question.id && "map" in rule
            ? {
                ...rule,
                map: Object.fromEntries(
                  values.map((value) => [
                    value,
                    rule.map[value] ?? (rule.kind === "multiplier" ? 1 : 0),
                  ]),
                ),
              }
            : rule,
        ),
    }));
  }
  function removeQuestion(id: string) {
    setTemplate((t) => ({
      ...t,
      questions: t.questions
        .filter((q) => q.id !== id)
        .map((q) => ({ ...q, showWhen: q.showWhen?.filter((c) => c.field !== id) })),
      rules: t.rules.filter(
        (rule) =>
          !("field" in rule && rule.field === id) &&
          !(rule.kind === "conditional" && rule.when.some((c) => c.field === id)),
      ),
    }));
  }
  function addQuestion() {
    const id = `question_${crypto.randomUUID().slice(0, 8)}`;
    const question: Question = {
      id,
      label: "New question",
      type: newType,
      required: true,
      ...(newType === "number" ? { min: 0, max: 100000, step: 1 } : {}),
      ...(["choice", "multiselect"].includes(newType)
        ? { options: [{ label: "First option", value: "first" }] }
        : {}),
    };
    setTemplate((t) => ({
      ...t,
      questions: [...t.questions, question],
      rules: [
        ...t.rules,
        ...(newType === "number"
          ? [{ kind: "number" as const, field: id, perUnit: 0 }]
          : newType === "choice" || newType === "multiselect"
            ? [{ kind: newType, field: id, map: { first: 0 } }]
            : []),
      ],
    }));
  }
  const previewConfig = useMemo<PublicQuoteConfig>(
    () => ({
      publicId: saved?.publicId ?? initial.slug,
      name: template.name,
      industry: template.industry,
      description: template.description,
      currency: template.currency,
      questions: template.questions,
      canCaptureLeads: false,
      businessName: settings.businessName,
      accentColor: settings.accentColor,
    }),
    [initial.slug, saved?.publicId, template, settings.businessName, settings.accentColor],
  );
  async function save() {
    setSaving(true);
    setError("");
    try {
      const allowedTemplate = {
        ...template,
        settings: {
          ...settings,
          businessName: features?.branding ? settings.businessName : undefined,
          accentColor: features?.branding ? settings.accentColor : undefined,
          followUps: features?.followUps ? settings.followUps : false,
          bookingRequests: features?.bookings ? settings.bookingRequests : false,
          deposits: features?.deposits ? settings.deposits : false,
        },
      };
      const response = await fetch(saved ? `/api/calculators/${saved.id}` : "/api/calculators", {
        method: saved ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          template: allowedTemplate,
          ...(saved ? { expectedVersion: saved.version } : {}),
        }),
      });
      const data = (await response.json()) as SavedCalculator & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save calculator");
      setSaved({ ...data, version: data.version ?? 1 });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save calculator");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="builder">
      <div className="card">
        <h2>Your calculator</h2>
        <label className="editor-field">
          Name
          <input
            className="field"
            value={template.name}
            onChange={(e) => setTemplate((t) => ({ ...t, name: e.target.value }))}
          />
        </label>
        <label className="editor-field">
          Description
          <textarea
            className="field"
            value={template.description}
            onChange={(e) => setTemplate((t) => ({ ...t, description: e.target.value }))}
          />
        </label>
        <label className="editor-field">
          Currency
          <select
            className="field"
            value={template.currency}
            onChange={(e) => setTemplate((t) => ({ ...t, currency: e.target.value }))}
          >
            {["EUR", "USD", "GBP", "RON", "CAD", "AUD"].map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
        </label>
        <div className="grid">
          <NumberField
            label="Minimum price before tax"
            value={template.minPrice ?? 0}
            onChange={(minPrice) => setTemplate((t) => ({ ...t, minPrice }))}
          />
          <NumberField
            label="Estimate range ± %"
            value={(template.rangePct ?? 0.08) * 100}
            max={50}
            onChange={(value) => setTemplate((t) => ({ ...t, rangePct: value / 100 }))}
          />
          <NumberField
            label="Tax added to estimate (%)"
            value={settings.taxRatePct ?? 0}
            max={100}
            onChange={(taxRatePct) => changeSettings({ taxRatePct })}
          />
        </div>
        <p className="muted">
          Use your actual rates and clearly label measurement units. The tax rate is your business
          setting, not automatic tax advice.
        </p>
        <p className="muted">
          Saving applies your current plan features; unavailable branding and customer actions will
          be removed.
        </p>
        <h3>Questions</h3>
        {template.questions.map((question) => (
          <QuestionEditor
            key={question.id}
            question={question}
            questions={template.questions}
            onChange={updateQuestion}
            onOptionsChange={updateOptions}
            onRemove={() => removeQuestion(question.id)}
          />
        ))}
        <div className="row">
          <label>
            Add question type
            <select
              className="field"
              value={newType}
              onChange={(e) => setNewType(e.target.value as Question["type"])}
            >
              {["number", "choice", "multiselect", "text", "postcode"].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn secondary" onClick={addQuestion}>
            Add question
          </button>
        </div>
        <h3>Pricing</h3>
        {template.rules.map((rule, index) => (
          <div className="editor-section" key={index}>
            <PricingEditor
              rule={rule}
              questions={template.questions}
              onChange={(updated) =>
                setTemplate((t) => ({
                  ...t,
                  rules: t.rules.map((r, i) => (i === index ? updated : r)),
                }))
              }
            />
            <button
              className="btn secondary"
              type="button"
              onClick={() =>
                setTemplate((t) => ({ ...t, rules: t.rules.filter((_, i) => i !== index) }))
              }
            >
              Remove adjustment
            </button>
          </div>
        ))}
        <button
          className="btn secondary"
          type="button"
          onClick={() =>
            setTemplate((t) => ({ ...t, rules: [...t.rules, { kind: "base", amount: 0 }] }))
          }
        >
          Add fixed adjustment
        </button>
        <button
          className="btn secondary"
          type="button"
          disabled={!template.questions.length}
          onClick={() =>
            setTemplate((t) => ({
              ...t,
              rules: [
                ...t.rules,
                {
                  kind: "conditional",
                  when: [{ field: t.questions[0].id, op: "truthy" }],
                  amount: 0,
                },
              ],
            }))
          }
        >
          Add conditional adjustment
        </button>
        {template.questions.some((q) => q.type === "choice") && (
          <button
            className="btn secondary"
            type="button"
            onClick={() => {
              const question = template.questions.find((q) => q.type === "choice")!;
              setTemplate((t) => ({
                ...t,
                rules: [
                  ...t.rules,
                  {
                    kind: "multiplier",
                    field: question.id,
                    map: Object.fromEntries(question.options!.map((o) => [o.value, 1])),
                  },
                ],
              }));
            }}
          >
            Add multiplier
          </button>
        )}
        <h3>Business features</h3>
        {features?.branding && (
          <>
            <label className="editor-field">
              Business name
              <input
                className="field"
                value={settings.businessName ?? ""}
                onChange={(e) => changeSettings({ businessName: e.target.value })}
              />
            </label>
            <label className="editor-field">
              Brand color
              <input
                type="color"
                value={settings.accentColor ?? "#5b5ce2"}
                onChange={(e) => changeSettings({ accentColor: e.target.value })}
              />
            </label>
          </>
        )}
        {features?.followUps && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={settings.followUps ?? false}
              onChange={(e) => changeSettings({ followUps: e.target.checked })}
            />
            Offer optional customer email follow-ups
          </label>
        )}
        {features?.bookings && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={settings.bookingRequests ?? false}
              onChange={(e) => changeSettings({ bookingRequests: e.target.checked })}
            />
            Allow customers to request a preferred booking time
          </label>
        )}
        {features?.deposits && (
          <>
            <label className="check-label">
              <input
                type="checkbox"
                checked={settings.deposits ?? false}
                onChange={(e) => changeSettings({ deposits: e.target.checked })}
              />
              Accept service deposits after connecting Stripe
            </label>
            <NumberField
              label="Deposit percentage"
              value={settings.depositPercent ?? 20}
              min={1}
              max={100}
              onChange={(depositPercent) => changeSettings({ depositPercent })}
            />
          </>
        )}
        <div className="action-row">
          <button className="btn" disabled={saving || !plan} onClick={() => void save()}>
            {saving ? "Saving…" : saved ? "Save changes" : "Create calculator"}
          </button>
          <button className="btn secondary" onClick={() => setPreviewKey((key) => key + 1)}>
            Refresh preview
          </button>
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <>
            <p className="success-panel">
              Saved revision {saved.version}. <a href={`/q/${saved.publicId}`}>Open calculator</a>
            </p>
            <h3>Website embed</h3>
            <pre className="code">{`<script async src="${appOrigin}/embed.js" data-service-quote="${saved.publicId}"></script>`}</pre>
            <p className="muted">No website? Share the calculator link directly.</p>
          </>
        )}
        {!plan && (
          <p className="notice">
            <a href="/billing">Choose a subscription</a> to save calculators.
          </p>
        )}
      </div>
      <div>
        <QuoteWidget key={previewKey} config={previewConfig} compact previewTemplate={template} />
      </div>
    </div>
  );
}
