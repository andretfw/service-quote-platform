import "server-only";
import { requireFeature } from "./workspace";
import type { PlanId } from "@/lib/plans";
import type { QuoteTemplate } from "@/lib/types";

export function assertCalculatorFeatures(template: QuoteTemplate, plan: PlanId | null) {
  requireFeature(plan);
  const settings = template.settings;
  if (settings?.businessName || settings?.accentColor || settings?.logoDataUrl)
    requireFeature(plan, "branding");
  if (settings?.followUps) requireFeature(plan, "followUps");
  if (settings?.bookingRequests) requireFeature(plan, "bookings");
  if (settings?.deposits) requireFeature(plan, "deposits");
}
