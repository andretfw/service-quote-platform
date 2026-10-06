export const plans = {
  basic: {
    name: "Basic",
    monthlyEur: 19,
    calculators: 1,
    monthlyLeads: 100,
    branding: false,
    exports: false,
    followUps: false,
    bookings: false,
    deposits: false,
  },
  premium: {
    name: "Premium",
    monthlyEur: 49,
    calculators: 5,
    monthlyLeads: 1000,
    branding: true,
    exports: true,
    followUps: true,
    bookings: false,
    deposits: false,
  },
  business: {
    name: "Business",
    monthlyEur: 99,
    calculators: 25,
    monthlyLeads: 10000,
    branding: true,
    exports: true,
    followUps: true,
    bookings: true,
    deposits: true,
  },
} as const;

export type PlanId = keyof typeof plans;
export type Feature = "branding" | "exports" | "followUps" | "bookings" | "deposits";
export const planIds = Object.keys(plans) as PlanId[];
export const isPlanId = (value: unknown): value is PlanId =>
  typeof value === "string" && Object.hasOwn(plans, value);

export type SubscriptionState = {
  plan: string;
  status: string;
  current_period_end: string | null;
};

export function effectivePlan(
  subscription: SubscriptionState | null,
  trialEndsAt: string,
  now = Date.now(),
): PlanId | null {
  if (subscription) {
    const expires = Date.parse(subscription.current_period_end ?? "");
    return isPlanId(subscription.plan) &&
      ["active", "trialing"].includes(subscription.status) &&
      Number.isFinite(expires) &&
      expires > now
      ? subscription.plan
      : null;
  }
  return Date.parse(trialEndsAt) > now ? "basic" : null;
}
