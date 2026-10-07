import "server-only";
import { translate, type Locale } from "@/lib/i18n";
import { escapeHtml } from "./security";

type RequestSummary = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  calculatorName: string;
  estimate: string;
  answers: { label: string; value: string }[];
};

export function leadNotificationMessage(
  lead: RequestSummary,
  appOrigin: string,
  locale: Locale = "en",
) {
  const t = (text: string) => translate(text, locale);
  const url = new URL(`/leads/${encodeURIComponent(lead.id)}`, appOrigin).href;
  const details = [
    { label: "Customer", value: lead.name },
    ...(lead.email ? [{ label: "Email", value: lead.email }] : []),
    ...(lead.phone ? [{ label: "Phone", value: lead.phone }] : []),
    { label: "Estimated range", value: lead.estimate },
    ...lead.answers,
  ];
  const rows = details
    .map(
      (item) =>
        `<tr><th style="text-align:left;padding:10px;vertical-align:top;border-bottom:1px solid #e5e7eb">${escapeHtml(t(item.label))}</th><td style="padding:10px;border-bottom:1px solid #e5e7eb;white-space:pre-wrap">${escapeHtml(item.value)}</td></tr>`,
    )
    .join("");
  return {
    subject: `${t("New enquiry")}: ${lead.calculatorName.replace(/[\r\n]/g, " ").slice(0, 120)}`,
    html: `<div style="font-family:Arial,sans-serif;color:#111827;max-width:640px;margin:auto"><p style="color:#6b7280">Service Quote · ${t("New enquiry")}</p><h1 style="font-size:24px">${escapeHtml(lead.calculatorName)}</h1><p>${t("A customer has requested a quote. Review their details and reply to confirm the scope and price.")}</p><table style="border-collapse:collapse;width:100%">${rows}</table><p style="margin-top:24px"><a href="${escapeHtml(url)}" style="background:#111827;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">${t("Review enquiry")}</a></p><p style="color:#6b7280;font-size:13px">${t("This is a preliminary estimate, not a confirmed booking or payment.")}</p></div>`,
    text: [
      `${t("New enquiry")}: ${lead.calculatorName}`,
      ...details.map((item) => `${t(item.label)}: ${item.value}`),
      `${t("Review enquiry")}: ${url}`,
      t("This is a preliminary estimate, not a confirmed booking or payment."),
    ].join("\n\n"),
    ...(lead.email ? { reply_to: lead.email } : {}),
  };
}
