"use client";
import BrandLogo from "@/components/BrandLogo";
import { Text, LocalizedInput } from "@/components/Language";

import { LanguageProvider, LanguageSelect, useLanguage } from "./Language";
import { localizeConfig } from "@/lib/localization";
import { locales, type Locale } from "@/lib/i18n";
import { units } from "@/lib/units";
import Image from "next/image";
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
      <LocalizedInput
        aria-label={question.label}
        className="field"
        type="number"
        min={question.min}
        max={question.max}
        step={question.unit ? "any" : (question.step ?? 1)}
        value={typeof value === "number" ? value : ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : Number(event.target.value))
        }
      />
    );
  }

  if (question.type === "text" || question.type === "postcode") {
    return (
      <LocalizedInput
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
            <Text>{option.label}</Text>
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
            <Text>{active ? "✓ " : ""}</Text>
            <Text>{option.label}</Text>
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

function QuoteExperience({ config, compact = false, previewTemplate }: QuoteWidgetProps) {
  const { locale, t } = useLanguage();
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
          locale,
          template: config.publicId,
          answers,
          lead,
          contactConsent,
          followUpConsent,
        }),
      });
      const data = (await response.json()) as SubmissionReceipt & {
        error?: string;
        estimate?: PublicQuoteResult;
      };
      if (!response.ok) throw new Error(data.error || "Could not save your request");
      if (data.estimate) setResult(data.estimate);
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
        {config.showPlatformBrand && (
          <div className="platform-brand">
            <BrandLogo />
          </div>
        )}
        {config.logoDataUrl && (
          <Image
            src={config.logoDataUrl}
            alt={config.businessName ? `${config.businessName} logo` : "Business logo"}
            width={160}
            height={80}
            unoptimized
            className="business-logo"
          />
        )}
        {config.businessName && <p className="brand">{config.businessName}</p>}
        <span className="pill">
          <Text>{"Instant estimate"}</Text>
        </span>
        <h2 className="result-title">
          <Text>{"Your estimated range"}</Text>
        </h2>
        <div className="price">
          {new Intl.NumberFormat(locale, {
            style: "currency",
            currency: result.currency,
            maximumFractionDigits: 0,
          }).format(result.low)}
          –
          {new Intl.NumberFormat(locale, {
            style: "currency",
            currency: result.currency,
            maximumFractionDigits: 0,
          }).format(result.high)}
        </div>
        <p className="muted">
          <Text>
            {
              "This is a preliminary estimate. Final pricing can change after the business confirms scope, measurements and site conditions."
            }
          </Text>
        </p>

        {error && (
          <p className="error-message">
            {t(/^[a-z0-9_]+: /i.test(error) ? "Please check your answers and try again." : error)}
          </p>
        )}

        {isPreview || !config.canCaptureLeads ? (
          <div className="success-panel">
            <strong>
              <Text>{isPreview ? "Preview mode" : "Template demo"}</Text>
            </strong>
            <p className="muted">
              <Text>
                {isPreview
                  ? "No lead is created while you preview an unsaved calculator."
                  : "This calculator is currently accepting estimates only. Contact the business directly for a quote request."}
              </Text>
            </p>
          </div>
        ) : !receipt ? (
          <>
            <h3>
              <Text>{"Get this estimate and request an exact quote"}</Text>
            </h3>
            <div className="options">
              <LocalizedInput
                aria-label="Your name"
                className="field"
                placeholder="Name"
                autoComplete="name"
                value={lead.name}
                onChange={(event) => setLead({ ...lead, name: event.target.value })}
              />
              <LocalizedInput
                className="field"
                aria-label="Your email"
                placeholder="Email"
                type="email"
                autoComplete="email"
                value={lead.email}
                onChange={(event) => setLead({ ...lead, email: event.target.value })}
              />
              <LocalizedInput
                className="field"
                aria-label="Your phone"
                placeholder="Phone"
                autoComplete="tel"
                value={lead.phone}
                onChange={(event) => setLead({ ...lead, phone: event.target.value })}
              />
              <label className="check-label">
                <LocalizedInput
                  type="checkbox"
                  checked={contactConsent}
                  onChange={(e) => setContactConsent(e.target.checked)}
                />
                <Text>{"I agree that this business may contact me about this request."}</Text>
              </label>
              {config.canFollowUp && (
                <label className="check-label">
                  <LocalizedInput
                    type="checkbox"
                    checked={followUpConsent}
                    onChange={(e) => setFollowUpConsent(e.target.checked)}
                  />
                  <Text>
                    {
                      "Send me optional email reminders about this estimate. I can unsubscribe at any time."
                    }
                  </Text>
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
                <Text>{pending ? "Sending…" : "Request exact quote"}</Text>
              </button>
            </div>
          </>
        ) : (
          <div className="success-panel">
            <strong>
              <Text>{"Request received."}</Text>
            </strong>
            <p className="muted">
              <Text>{"The business can now review your estimate and follow up."}</Text>
            </p>
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

  if (!current)
    return (
      <div className="card">
        <Text>{"No questions configured."}</Text>
      </div>
    );

  return (
    <div className="card" style={{ "--brand-color": config.accentColor } as CSSProperties}>
      {config.showPlatformBrand && (
        <div className="platform-brand">
          <BrandLogo />
        </div>
      )}
      {config.logoDataUrl && (
        <Image
          src={config.logoDataUrl}
          alt={config.businessName ? `${config.businessName} logo` : "Business logo"}
          width={160}
          height={80}
          unoptimized
          className="business-logo"
        />
      )}
      {config.businessName && <p className="brand">{config.businessName}</p>}
      {!compact && (
        <>
          <span className="pill">
            <Text>{config.industry}</Text>
          </span>
          <h1 className="widget-title">
            <Text>{config.name}</Text>
          </h1>
          <p className="muted">
            <Text>{config.description}</Text>
          </p>
        </>
      )}

      <div className="progress" aria-hidden="true">
        <div style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>
      <div className="row">
        <span className="muted">
          {t("Question {current} of {total}", { current: index + 1, total: questions.length })}
        </span>
        <span className="pill">
          <Text>{"Instant estimate"}</Text>
        </span>
      </div>

      <h2>
        {current.label}
        {current.unit && <span className="unit-tag">{units[current.unit].symbol}</span>}
      </h2>
      {current.help && <p className="muted">{current.help}</p>}
      {questionInput(current, answers[current.id], (value) =>
        setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: value })),
      )}

      {error && (
        <p className="error-message">
          {t(/^[a-z0-9_]+: /i.test(error) ? "Please check your answers and try again." : error)}
        </p>
      )}

      <div className="row action-row">
        <button
          className="btn secondary"
          disabled={index === 0 || pending}
          onClick={() => setIndex((currentIndex) => Math.max(0, currentIndex - 1))}
        >
          <Text>{"Back"}</Text>
        </button>
        <button className="btn" disabled={!canContinue || pending} onClick={next}>
          <Text>
            {pending
              ? "Calculating…"
              : index === questions.length - 1
                ? "See estimate"
                : "Continue"}
          </Text>
        </button>
      </div>
    </div>
  );
}

export default function QuoteWidget(props: QuoteWidgetProps) {
  const [locale, setLocale] = useState<Locale>(props.config.locale ?? "en");
  const available = props.config.languages ?? locales;
  const selected = available.includes(locale) ? locale : available[0];
  const config = localizeConfig(props.config, selected);
  return (
    <LanguageProvider locale={selected}>
      <div className="quote-experience" lang={selected}>
        {available.length > 1 && (
          <div className="quote-language">
            <LanguageSelect
              available={available}
              value={selected}
              onChange={(next) => {
                if (available.includes(next)) setLocale(next);
              }}
            />
          </div>
        )}
        <QuoteExperience {...props} config={config} />
      </div>
    </LanguageProvider>
  );
}
