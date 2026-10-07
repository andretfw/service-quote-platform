import "server-only";
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

export function leadNotificationMessage(lead: RequestSummary, appOrigin: string) {
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
        `<tr><th style="text-align:left;padding:10px;vertical-align:top;border-bottom:1px solid #e5e7eb">${escapeHtml(item.label)}</th><td style="padding:10px;border-bottom:1px solid #e5e7eb;white-space:pre-wrap">${escapeHtml(item.value)}</td></tr>`,
    )
    .join("");
  return {
    subject: `New enquiry: ${lead.calculatorName.replace(/[\r\n]/g, " ").slice(0, 120)}`,
    html: `<div style="font-family:Arial,sans-serif;color:#111827;max-width:640px;margin:auto"><p style="color:#6b7280">Service Quote · New enquiry</p><h1 style="font-size:24px">${escapeHtml(lead.calculatorName)}</h1><p>A customer has requested a quote. Review their details and reply to confirm the scope and price.</p><table style="border-collapse:collapse;width:100%">${rows}</table><p style="margin-top:24px"><a href="${escapeHtml(url)}" style="background:#111827;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">Review enquiry</a></p><p style="color:#6b7280;font-size:13px">This is a preliminary estimate, not a confirmed booking or payment.</p></div>`,
    text: [
      `New enquiry: ${lead.calculatorName}`,
      ...details.map((item) => `${item.label}: ${item.value}`),
      `Review enquiry: ${url}`,
      "This is a preliminary estimate, not a confirmed booking or payment.",
    ].join("\n\n"),
    ...(lead.email ? { reply_to: lead.email } : {}),
  };
}
