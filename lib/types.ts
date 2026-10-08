import type { Locale } from "./i18n";
import type { Unit } from "./units";
export type Translation = { label: string; help?: string; options?: Record<string, string> };
export type AnswerValue = string | number | boolean | string[] | null;
export type Answers = Record<string, AnswerValue>;

export type Condition = {
  field: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "includes" | "truthy";
  value?: string | number | boolean;
};

export type Option = {
  label: string;
  value: string;
};

export type Question = {
  id: string;
  label: string;
  help?: string;
  type: "choice" | "multiselect" | "number" | "text" | "postcode";
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: Option[];
  showWhen?: Condition[];
  unit?: Unit;
  translations?: Partial<Record<Locale, Translation>>;
};

export type PricingRule =
  | { kind: "base"; amount: number }
  | {
      kind: "number";
      field: string;
      perUnit: number;
      when?: Condition[];
      minUnits?: number;
      maxUnits?: number;
    }
  | { kind: "choice"; field: string; map: Record<string, number> }
  | { kind: "multiselect"; field: string; map: Record<string, number> }
  | { kind: "conditional"; when: Condition[]; amount: number }
  | { kind: "multiplier"; field: string; map: Record<string, number> };

export type CalculatorSettings = {
  locale?: Locale;
  languages?: Locale[];
  businessName?: string;
  accentColor?: string;
  logoDataUrl?: string;
  bookingRequests?: boolean;
  deposits?: boolean;
  followUps?: boolean;
  depositPercent?: number;
  taxRatePct?: number;
};

export type QuoteTemplate = {
  translations?: Partial<Record<Locale, { name: string; description: string; industry: string }>>;
  settings?: CalculatorSettings;
  slug: string;
  name: string;
  industry: string;
  description: string;
  currency: string;
  minPrice?: number;
  rangePct?: number;
  questions: Question[];
  rules: PricingRule[];
};

/** Safe to serialize to untrusted browsers. Never add pricing rules here. */
export type PublicQuoteConfig = {
  locale?: Locale;
  languages?: Locale[];
  translations?: QuoteTemplate["translations"];
  publicId: string;
  name: string;
  industry: string;
  description: string;
  currency: string;
  questions: Question[];
  canCaptureLeads: boolean;
  showPlatformBrand?: boolean;
  businessName?: string;
  accentColor?: string;
  logoDataUrl?: string;
  canRequestBooking?: boolean;
  canPayDeposit?: boolean;
  canFollowUp?: boolean;
};

export type QuoteResult = {
  subtotal: number;
  low: number;
  high: number;
  currency: string;
  breakdown: { label: string; amount: number }[];
};

/** Minimal estimate shape safe to return to an untrusted customer browser. */
export type PublicQuoteResult = Pick<QuoteResult, "low" | "high" | "currency">;
