export const plans = {
  free: {
    name: "Free",
    monthlyEur: 0,
    calculators: 1,
    monthlyLeads: 7,
    integrations: false,
    branding: false,
    exports: false,
    followUps: false,
    bookings: false,
    deposits: false,
  },
  basic: {
    name: "Basic",
    monthlyEur: 9,
    calculators: 5,
    monthlyLeads: 100,
    integrations: false,
    branding: false,
    exports: false,
    followUps: false,
    bookings: false,
    deposits: false,
  },
  premium: {
    name: "Premium",
    monthlyEur: 19,
    calculators: 15,
    monthlyLeads: 1000,
    integrations: true,
    branding: true,
    exports: true,
    followUps: true,
    bookings: false,
    deposits: false,
  },
  business: {
    name: "Business",
    monthlyEur: 39,
    calculators: 50,
    monthlyLeads: 2000,
    integrations: true,
    branding: true,
    exports: true,
    followUps: true,
    bookings: true,
    deposits: true,
  },
} as const;

export type PlanId = keyof typeof plans;
export type PaidPlanId = Exclude<PlanId, "free">;
export const paidPlanIds = ["basic", "premium", "business"] as const;
export type Feature =
  | "branding"
  | "exports"
  | "followUps"
  | "bookings"
  | "deposits"
  | "integrations";
export const planIds = Object.keys(plans) as PlanId[];
export const isPlanId = (value: unknown): value is PlanId =>
  typeof value === "string" && Object.hasOwn(plans, value);

export type SubscriptionState = {
  plan: string;
  status: string;
  current_period_end: string | null;
};

export const isPaidPlanId = (value: unknown): value is PaidPlanId =>
  isPlanId(value) && value !== "free";

export function effectivePlan(subscription: SubscriptionState | null, now = Date.now()): PlanId {
  if (subscription) {
    const expires = Date.parse(subscription.current_period_end ?? "");
    if (
      isPaidPlanId(subscription.plan) &&
      ["active", "trialing"].includes(subscription.status) &&
      Number.isFinite(expires) &&
      expires > now
    )
      return subscription.plan;
  }
  return "free";
}
