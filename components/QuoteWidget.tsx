"use client";

import CustomerActions from "./CustomerActions";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { calculateQuote, toPublicQuoteResult, visibleQuestions } from "@/lib/pricing-engine";
import type {
  AnswerValue,
  Answers,
  PublicQuoteConfig,
  PublicQuoteResult,
  QuoteTemplate,
  Question,
} from "@/lib/types";

type Lead = { name: string; email: string; phone: string };
type SubmissionReceipt = { submissionId?: string; accessToken?: string; demo?: boolean };

type QuoteWidgetProps = {
  config: PublicQuoteConfig;
  compact?: boolean;
  previewTemplate?: QuoteTemplate;
};

function questionInput(
  question: Question,
  value: AnswerValue | undefined,
  onChange: (value: AnswerValue) => void,
) {
  if (question.type === "number") {
    return (
      <input
        aria-label={question.label}
        className="field"
        type="number"
        min={question.min}
        max={question.max}
        step={question.step ?? 1}
        value={typeof value === "number" ? value : ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : Number(event.target.value))
        }
      />
    );
  }

  if (question.type === "text" || question.type === "postcode") {
    return (
      <input
        aria-label={question.label}
        className="field"
        value={typeof value === "string" ? value : ""}
        placeholder={question.type === "postcode" ? "ZIP / postcode" : "Type here"}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (question.type === "choice") {
    return (
      <div className="options" role="group" aria-label={question.label}>
        {question.options?.map((option) => (
          <button
            type="button"
            key={option.value}
            className={`option ${value === option.value ? "selected" : ""}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  const selected = Array.isArray(value) ? value : [];
  return (
    <div className="options" role="group" aria-label={question.label}>
      {question.options?.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            type="button"
            key={option.value}
            className={`option ${active ? "selected" : ""}`}
            aria-pressed={active}
            onClick={() =>
              onChange(
                active
                  ? selected.filter((item) => item !== option.value)
                  : [...selected, option.value],
              )
            }
          >
            {active ? "✓ " : ""}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const hasAnswer = (value: AnswerValue | undefined): boolean =>
  value !== undefined &&
  value !== null &&
  value !== "" &&
  !(Array.isArray(value) && value.length === 0);

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

export default function QuoteWidget({
  config,
  compact = false,
  previewTemplate,
}: QuoteWidgetProps) {
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<PublicQuoteResult | null>(null);
  const [lead, setLead] = useState<Lead>({ name: "", email: "", phone: "" });
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contactConsent, setContactConsent] = useState(false);
  const [followUpConsent, setFollowUpConsent] = useState(false);
  const [pending, setPending] = useState(false);

  const questions = useMemo(() => visibleQuestions(config, answers), [config, answers]);
  const current = questions[Math.min(index, Math.max(0, questions.length - 1))];
  const canContinue = current ? !current.required || hasAnswer(answers[current.id]) : false;
  const isPreview = Boolean(previewTemplate);

  const calculate = async () => {
    setPending(true);
    setError(null);

    try {
      if (previewTemplate) {
        setResult(toPublicQuoteResult(calculateQuote(previewTemplate, answers)));
        return;
      }

      const response = await fetch("/api/public/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template: config.publicId, answers }),
      });
      const data = (await response.json()) as PublicQuoteResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not calculate this estimate");
      setResult(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Could not calculate this estimate",
      );
    } finally {
      setPending(false);
    }
  };

  const next = () => {
    if (index < questions.length - 1) setIndex((currentIndex) => currentIndex + 1);
    else void calculate();
  };

  const submit = async () => {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/public/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          template: config.publicId,
          answers,
          lead,
          contactConsent,
          followUpConsent,
        }),
      });
      const data = (await response.json()) as SubmissionReceipt & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save your request");
      setReceipt(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Could not save your request",
      );
    } finally {
      setPending(false);
    }
  };

  if (result) {
    return (
      <div
        className="card"
        style={{ "--brand-color": config.accentColor } as CSSProperties}
        aria-live="polite"
      >
        {config.businessName && <p className="brand">{config.businessName}</p>}
        <span className="pill">Instant estimate</span>
        <h2 className="result-title">Your estimated range</h2>
        <div className="price">
          {formatMoney(result.low, result.currency)}–{formatMoney(result.high, result.currency)}
        </div>
        <p className="muted">
          This is a preliminary estimate. Final pricing can change after the business confirms
          scope, measurements and site conditions.
        </p>

        {error && <p className="error-message">{error}</p>}

        {isPreview || !config.canCaptureLeads ? (
          <div className="success-panel">
            <strong>{isPreview ? "Preview mode" : "Template demo"}</strong>
            <p className="muted">
              {isPreview
                ? "No lead is created while you preview an unsaved calculator."
                : "This calculator is currently accepting estimates only. Contact the business directly for a quote request."}
            </p>
          </div>
        ) : !receipt ? (
          <>
            <h3>Get this estimate and request an exact quote</h3>
            <div className="options">
              <input
                aria-label="Your name"
                className="field"
                placeholder="Name"
                autoComplete="name"
                value={lead.name}
                onChange={(event) => setLead({ ...lead, name: event.target.value })}
              />
              <input
                className="field"
                aria-label="Your email"
                placeholder="Email"
                type="email"
                autoComplete="email"
                value={lead.email}
                onChange={(event) => setLead({ ...lead, email: event.target.value })}
              />
              <input
                className="field"
                aria-label="Your phone"
                placeholder="Phone"
                autoComplete="tel"
                value={lead.phone}
                onChange={(event) => setLead({ ...lead, phone: event.target.value })}
              />
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={contactConsent}
                  onChange={(e) => setContactConsent(e.target.checked)}
                />
                I agree that this business may contact me about this request.
              </label>
              {config.canFollowUp && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={followUpConsent}
                    onChange={(e) => setFollowUpConsent(e.target.checked)}
                  />
                  Send me optional email reminders about this estimate. I can unsubscribe at any
                  time.
                </label>
              )}
              <button
                className="btn"
                disabled={
                  pending ||
                  !contactConsent ||
                  !lead.name.trim() ||
                  (!lead.email.trim() && !lead.phone.trim())
                }
                onClick={() => void submit()}
              >
                {pending ? "Sending…" : "Request exact quote"}
              </button>
            </div>
          </>
        ) : (
          <div className="success-panel">
            <strong>Request received.</strong>
            <p className="muted">The business can now review your estimate and follow up.</p>
            {receipt.submissionId && receipt.accessToken && (
              <CustomerActions
                submissionId={receipt.submissionId}
                accessToken={receipt.accessToken}
                bookings={config.canRequestBooking}
                deposits={config.canPayDeposit}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  if (!current) return <div className="card">No questions configured.</div>;

  return (
    <div className="card" style={{ "--brand-color": config.accentColor } as CSSProperties}>
      {config.businessName && <p className="brand">{config.businessName}</p>}
      {!compact && (
        <>
          <span className="pill">{config.industry}</span>
          <h1 className="widget-title">{config.name}</h1>
          <p className="muted">{config.description}</p>
        </>
      )}

      <div className="progress" aria-hidden="true">
        <div style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>
      <div className="row">
        <span className="muted">
          Question {index + 1} of {questions.length}
        </span>
        <span className="pill">Instant estimate</span>
      </div>

      <h2>{current.label}</h2>
      {current.help && <p className="muted">{current.help}</p>}
      {questionInput(current, answers[current.id], (value) =>
        setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: value })),
      )}

      {error && <p className="error-message">{error}</p>}

      <div className="row action-row">
        <button
          className="btn secondary"
          disabled={index === 0 || pending}
          onClick={() => setIndex((currentIndex) => Math.max(0, currentIndex - 1))}
        >
          Back
        </button>
        <button className="btn" disabled={!canContinue || pending} onClick={next}>
          {pending ? "Calculating…" : index === questions.length - 1 ? "See estimate" : "Continue"}
        </button>
      </div>
    </div>
  );
}
