"use client";
import { useEffect, useMemo, useState } from "react";
import { LanguageSelect, useLanguage } from "./Language";
import { locales, languageNames, type Locale } from "@/lib/i18n";
import { localizeQuestion } from "@/lib/localization";
import { convertQuestionUnit, measurementSystem, inferredUnit, type Unit } from "@/lib/units";
import LogoUpload from "./LogoUpload";
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
  const { t, locale } = useLanguage();
  const [step, setStep] = useState(0);
  const [contentLocale, setContentLocale] = useState<Locale>(initial.settings?.locale ?? locale);
  const [device, setDevice] = useState("desktop");
  const [snapshot, setSnapshot] = useState(JSON.stringify(initial));
  const [copied, setCopied] = useState(false);
  const [template, setTemplate] = useState<QuoteTemplate>(initial);
  const [saved, setSaved] = useState<SavedCalculator | null>(existing ?? null);
  const [error, setError] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newType, setNewType] = useState<Question["type"]>("number");
  const [previewKey, setPreviewKey] = useState(0);
  const features = plan ? plans[plan] : null;
  const settings = template.settings ?? {};
  const dirty = JSON.stringify(template) !== snapshot;
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const headings = [
    "Business & region",
    "Services & prices",
    "Questions",
    "Appearance",
    "Test & share",
  ];
  const displayedQuestions = template.questions.map((q) => localizeQuestion(q, contentLocale));
  function editWording(question: Question) {
    const original = template.questions.find((q) => q.id === question.id)!;
    updateQuestion({
      ...question,
      label: contentLocale === "en" ? question.label : original.label,
      help: contentLocale === "en" ? question.help : original.help,
      options: question.options?.map((o) => ({
        ...o,
        label:
          contentLocale === "en"
            ? o.label
            : (original.options?.find((x) => x.value === o.value)?.label ?? o.label),
      })),
      translations: {
        ...original.translations,
        [contentLocale]: {
          label: question.label,
          help: question.help,
          options: Object.fromEntries((question.options ?? []).map((o) => [o.value, o.label])),
        },
      },
    });
  }
  function content(field: "name" | "description", value: string) {
    setTemplate((current) => ({
      ...current,
      ...(contentLocale === "en" ? { [field]: value } : {}),
      translations: {
        ...current.translations,
        [contentLocale]: {
          name: current.name,
          description: current.description,
          industry: current.industry,
          ...current.translations?.[contentLocale],
          [field]: value,
        },
      },
    }));
  }
  function convert(id: string, unit: Unit) {
    try {
      setTemplate((current) => convertQuestionUnit(current, id, unit));
      setPreviewKey((k) => k + 1);
      setError("");
    } catch {
      setError(t("Incompatible measurement units"));
    }
  }
  function usesSystem(system: "metric" | "imperial") {
    const candidates =
      system === "metric"
        ? ["m2", "cm2", "m", "cm", "km", "m3", "kg"]
        : ["ft2", "ft", "mi", "yd3", "lb"];
    return template.questions.some((q) => {
      const unit = inferredUnit(q);
      return unit && candidates.includes(unit);
    });
  }
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
              "when" in rule &&
              rule.when &&
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
          !("when" in rule && rule.when && rule.when.some((c) => c.field === id)),
      ),
    }));
  }
  function addQuestion() {
    const id = `question_${crypto.randomUUID().slice(0, 8)}`;
    const question: Question = {
      id,
      label: "New question",
      translations: Object.fromEntries(
        locales.map((lang) => [
          lang,
          {
            label:
              lang === "es" ? "Nueva pregunta" : lang === "ro" ? "Întrebare nouă" : "New question",
          },
        ]),
      ),
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
      locale: settings.locale,
      languages: settings.languages,
      translations: template.translations,
      publicId: saved?.publicId ?? initial.slug,
      name: template.name,
      industry: template.industry,
      description: template.description,
      currency: template.currency,
      questions: template.questions,
      canCaptureLeads: false,
      businessName: settings.businessName,
      accentColor: settings.accentColor,
      logoDataUrl: settings.logoDataUrl,
    }),
    [
      initial.slug,
      saved?.publicId,
      template,
      settings.businessName,
      settings.accentColor,
      settings.logoDataUrl,
      settings.languages,
      settings.locale,
    ],
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
          logoDataUrl: features?.branding ? settings.logoDataUrl : undefined,
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
      setSnapshot(JSON.stringify(template));
      setStep(4);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save calculator");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="builder-workspace">
      <nav className="builder-steps" aria-label={t("Calculator setup")}>
        {headings.map((heading, i) => (
          <button
            key={heading}
            type="button"
            className={i === step ? "active" : ""}
            aria-current={i === step ? "step" : undefined}
            onClick={() => setStep(i)}
          >
            <span>{i + 1}</span>
            {t(heading)}
          </button>
        ))}
      </nav>
      <div className="builder">
        <section className="card editor-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t("Your calculator")}</span>
              <h2>{t(headings[step])}</h2>
            </div>
            <span className={`save-state ${dirty ? "dirty" : ""}`}>
              {t(!saved ? "Not published" : dirty ? "Changes not saved" : "All changes saved")}
            </span>
          </div>
          {(step === 0 || step === 2) && (
            <div className="content-language">
              <span>{t("Language content")}</span>
              <LanguageSelect value={contentLocale} onChange={setContentLocale} />
            </div>
          )}
          {step === 0 && (
            <>
              <label className="editor-field">
                {t("Calculator name")}
                <input
                  className="field"
                  value={template.translations?.[contentLocale]?.name ?? template.name}
                  onChange={(e) => content("name", e.target.value)}
                />
              </label>
              <label className="editor-field">
                {t("Description")}
                <textarea
                  className="field"
                  rows={3}
                  value={
                    template.translations?.[contentLocale]?.description ?? template.description
                  }
                  onChange={(e) => content("description", e.target.value)}
                />
              </label>
              <div className="form-grid">
                <label className="editor-field">
                  {t("Language")}
                  <select
                    className="field"
                    value={settings.locale ?? "en"}
                    onChange={(e) => {
                      const next = e.target.value as Locale;
                      changeSettings({
                        locale: next,
                        languages: Array.from(
                          new Set([...(settings.languages ?? [...locales]), next]),
                        ),
                      });
                      setContentLocale(next);
                    }}
                  >
                    {locales.map((lang) => (
                      <option key={lang} value={lang}>
                        {languageNames[lang]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="editor-field">
                  {t("Currency")}
                  <select
                    className="field"
                    value={template.currency}
                    onChange={(e) =>
                      setTemplate((current) => ({ ...current, currency: e.target.value }))
                    }
                  >
                    {["EUR", "RON", "USD", "GBP", "CAD", "AUD"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="muted small">
                {t(
                  "Changing currency does not exchange prices. Review every rate before publishing.",
                )}
              </p>
              <fieldset className="language-options">
                <legend>{t("Customer languages")}</legend>
                {locales.map((lang) => (
                  <label className="check-label" key={lang}>
                    <input
                      type="checkbox"
                      checked={(settings.languages ?? [...locales]).includes(lang)}
                      disabled={lang === (settings.locale ?? "en")}
                      onChange={(e) =>
                        changeSettings({
                          languages: e.target.checked
                            ? [...(settings.languages ?? [...locales]), lang]
                            : (settings.languages ?? [...locales]).filter((l) => l !== lang),
                        })
                      }
                    />
                    {languageNames[lang]}
                  </label>
                ))}
              </fieldset>
              <h3>{t("Measurement system")}</h3>
              <div className="segmented">
                {(["metric", "imperial"] as const).map((system) => (
                  <button
                    type="button"
                    key={system}
                    className={usesSystem(system) ? "active" : ""}
                    aria-pressed={usesSystem(system)}
                    onClick={() => {
                      setTemplate((current) => measurementSystem(current, system));
                      setPreviewKey((k) => k + 1);
                    }}
                  >
                    {t(system === "metric" ? "Metric" : "Imperial")}
                  </button>
                ))}
              </div>
              <p className="muted small">
                {t("Unit conversion preserves the price for the same physical quantity.")}
              </p>
            </>
          )}
          {step === 1 && (
            <>
              <p className="notice">
                {t("Example rates — replace them with your own prices before sharing.")}
              </p>
              <div className="form-grid">
                <NumberField
                  label="Minimum price before tax"
                  value={template.minPrice ?? 0}
                  onChange={(minPrice) => setTemplate((current) => ({ ...current, minPrice }))}
                />
                <NumberField
                  label="Tax added to estimate (%)"
                  value={settings.taxRatePct ?? 0}
                  max={100}
                  onChange={(taxRatePct) => changeSettings({ taxRatePct })}
                />
              </div>
              {template.rules.map((rule, index) => (
                <div className="rate-card" key={index}>
                  <PricingEditor
                    rule={rule}
                    questions={displayedQuestions}
                    onChange={(updated) =>
                      setTemplate((current) => ({
                        ...current,
                        rules: current.rules.map((r, i) => (i === index ? updated : r)),
                      }))
                    }
                  />
                </div>
              ))}
              <details className="advanced-panel">
                <summary>{t("Advanced settings")}</summary>
                <NumberField
                  label="Estimate range ± %"
                  value={(template.rangePct ?? 0.08) * 100}
                  max={50}
                  onChange={(value) =>
                    setTemplate((current) => ({ ...current, rangePct: value / 100 }))
                  }
                />
                <div className="action-row">
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() =>
                      setTemplate((current) => ({
                        ...current,
                        rules: [...current.rules, { kind: "base", amount: 0 }],
                      }))
                    }
                  >
                    {t("Add fixed adjustment")}
                  </button>
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={!template.questions.some((q) => q.type === "number")}
                    onClick={() => {
                      const q = template.questions.find((q) => q.type === "number")!;
                      setTemplate((current) => ({
                        ...current,
                        rules: [...current.rules, { kind: "number", field: q.id, perUnit: 0 }],
                      }));
                    }}
                  >
                    {t("Add quantity rate")}
                  </button>
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={!template.questions.length}
                    onClick={() =>
                      setTemplate((current) => ({
                        ...current,
                        rules: [
                          ...current.rules,
                          {
                            kind: "conditional",
                            when: [{ field: current.questions[0].id, op: "truthy" }],
                            amount: 0,
                          },
                        ],
                      }))
                    }
                  >
                    {t("Add conditional adjustment")}
                  </button>
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={!template.questions.some((q) => q.type === "choice")}
                    onClick={() => {
                      const q = template.questions.find((q) => q.type === "choice")!;
                      setTemplate((current) => ({
                        ...current,
                        rules: [
                          ...current.rules,
                          {
                            kind: "multiplier",
                            field: q.id,
                            map: Object.fromEntries((q.options ?? []).map((o) => [o.value, 1])),
                          },
                        ],
                      }));
                    }}
                  >
                    {t("Add price multiplier")}
                  </button>
                </div>
                <p className="muted small">
                  {t("Your prices stay private; customers see only the estimated range.")}
                </p>
                {template.rules.map((rule, i) => (
                  <button
                    className="text-button"
                    type="button"
                    key={i}
                    onClick={() =>
                      setTemplate((current) => ({
                        ...current,
                        rules: current.rules.filter((_, n) => n !== i),
                      }))
                    }
                  >
                    {t("Remove adjustment")} {i + 1}
                  </button>
                ))}
              </details>
            </>
          )}
          {step === 2 && (
            <>
              <p className="muted">
                {t("Edit your own wording for each language. Prices and conditions are shared.")}
              </p>
              {displayedQuestions.map((q, index) => (
                <div key={q.id} className="question-card">
                  <QuestionEditor
                    question={q}
                    questions={displayedQuestions}
                    onChange={editWording}
                    onOptionsChange={(question) => {
                      updateOptions(question);
                      editWording(question);
                    }}
                    onRemove={() => removeQuestion(q.id)}
                    onUnitChange={(unit) => convert(q.id, unit)}
                  />
                  <div className="question-order">
                    <button
                      className="text-button"
                      type="button"
                      disabled={index === 0}
                      onClick={() =>
                        setTemplate((current) => {
                          const questions = [...current.questions];
                          [questions[index - 1], questions[index]] = [
                            questions[index],
                            questions[index - 1],
                          ];
                          return { ...current, questions };
                        })
                      }
                    >
                      {t("Move up")}
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      disabled={index === template.questions.length - 1}
                      onClick={() =>
                        setTemplate((current) => {
                          const questions = [...current.questions];
                          [questions[index + 1], questions[index]] = [
                            questions[index],
                            questions[index + 1],
                          ];
                          return { ...current, questions };
                        })
                      }
                    >
                      {t("Move down")}
                    </button>
                  </div>
                </div>
              ))}
              <div className="action-row">
                <select
                  aria-label={t("Add question type")}
                  className="field"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as Question["type"])}
                >
                  {[
                    ["number", "Number"],
                    ["choice", "Single choice"],
                    ["multiselect", "Multiple choice"],
                    ["text", "Text"],
                    ["postcode", "Postcode"],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>
                      {t(label)}
                    </option>
                  ))}
                </select>
                <button className="btn secondary" type="button" onClick={addQuestion}>
                  {t("Add question")}
                </button>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              {features?.branding ? (
                <>
                  <LogoUpload
                    value={settings.logoDataUrl}
                    onChange={(logoDataUrl) => changeSettings({ logoDataUrl })}
                    onBusyChange={setLogoUploading}
                  />
                  <label className="editor-field">
                    {t("Business name")}
                    <input
                      className="field"
                      value={settings.businessName ?? ""}
                      onChange={(e) => changeSettings({ businessName: e.target.value })}
                    />
                  </label>
                  <label className="editor-field">
                    {t("Brand color")}
                    <input
                      type="color"
                      value={settings.accentColor ?? "#0f766e"}
                      onChange={(e) => changeSettings({ accentColor: e.target.value })}
                    />
                  </label>
                </>
              ) : (
                <p className="notice">{t("Appearance is included in Premium and Business.")}</p>
              )}
              <h3>{t("Business features")}</h3>
              {features?.followUps && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={settings.followUps ?? false}
                    onChange={(e) => changeSettings({ followUps: e.target.checked })}
                  />
                  {t("Offer optional customer email follow-ups")}
                </label>
              )}
              {features?.bookings && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={settings.bookingRequests ?? false}
                    onChange={(e) => changeSettings({ bookingRequests: e.target.checked })}
                  />
                  {t("Allow customers to request a preferred booking time")}
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
                    {t("Accept service deposits after connecting Stripe")}
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
            </>
          )}
          {step === 4 && (
            <>
              <h3>{t("Ready to share")}</h3>
              <p className="muted">
                {t("Test your rates in the preview before sharing your calculator.")}
              </p>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setPreviewKey((key) => key + 1)}
              >
                {t("Refresh preview")}
              </button>
              {saved && (
                <div className="share-panel">
                  <h3>{t("Share link")}</h3>
                  <a className="share-url" href={`/q/${saved.publicId}`}>
                    {appOrigin}/q/{saved.publicId}
                  </a>
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`${appOrigin}/q/${saved.publicId}`);
                        setCopied(true);
                      } catch {
                        setCopied(false);
                      }
                    }}
                  >
                    {t(copied ? "Copied" : "Copy link")}
                  </button>
                  <h3>{t("Website embed")}</h3>
                  <pre className="code">{`<script async src="${appOrigin}/embed.js" data-service-quote="${saved.publicId}"></script>`}</pre>
                  <p className="muted small">
                    {t("No website? Share the calculator link directly.")}
                  </p>
                </div>
              )}
            </>
          )}
          {error && (
            <p className="error-message" role="alert">
              {t(error)}
            </p>
          )}
          {!plan && (
            <p className="notice">
              <a href="/billing">{t("Choose a subscription")}</a> {t("to save calculators.")}
            </p>
          )}
          <div className="builder-footer">
            <button
              className="btn secondary"
              type="button"
              disabled={step === 0}
              onClick={() => setStep((n) => n - 1)}
            >
              {t("Back")}
            </button>
            {step < 4 ? (
              <button className="btn" type="button" onClick={() => setStep((n) => n + 1)}>
                {t("Continue")}
              </button>
            ) : (
              <button
                className="btn"
                type="button"
                disabled={saving || logoUploading || !plan}
                onClick={() => void save()}
              >
                {t(saving ? "Saving…" : saved ? "Save changes" : "Create calculator")}
              </button>
            )}
          </div>
        </section>
        <aside className={`builder-preview ${device}`}>
          <div className="preview-toolbar">
            <span>{t("Live preview")}</span>
            <div className="segmented">
              {["desktop", "mobile"].map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={device === value}
                  className={device === value ? "active" : ""}
                  onClick={() => setDevice(value)}
                >
                  {t(value === "mobile" ? "Mobile" : "Desktop")}
                </button>
              ))}
            </div>
          </div>
          <QuoteWidget key={previewKey} config={previewConfig} compact previewTemplate={template} />
        </aside>
      </div>
    </div>
  );
}
