import "server-only";
import { translate, type Locale } from "@/lib/i18n";
import { escapeHtml } from "./security";

export function customerReminderMessage(
  lead: { name: string; business: string; calculator: string; estimate: string; replyTo: string },
  unsubscribeUrl: string,
  locale: Locale,
) {
  const t = (source: string) => translate(source, locale);
  const business = lead.business.replace(/[\r\n]/g, " ").slice(0, 160);
  const oneClickUrl = unsubscribeUrl.replace("/unsubscribe?", "/api/public/unsubscribe?");
  const replyUrl = `mailto:${encodeURIComponent(lead.replyTo)}`;
  return {
    subject: `${business}: ${t("Still interested in your estimate?")}`,
    reply_to: lead.replyTo,
    headers: {
      "List-Unsubscribe": `<${oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    text: [
      `${t("Hi")} ${lead.name},`,
      `${business} · ${lead.calculator}`,
      `${t("Estimated range")}: ${lead.estimate}`,
      t("Just checking whether you would like to continue with your estimate request."),
      `${t("Reply to the business to discuss your request.")} ${lead.replyTo}`,
      t("This is a preliminary estimate, not a confirmed booking or payment."),
      `${t("Unsubscribe from reminders")}: ${unsubscribeUrl}`,
    ].join("\n\n"),
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><p>${escapeHtml(business)}</p><h1 style="font-size:22px">${escapeHtml(lead.calculator)}</h1><p>${t("Hi")} ${escapeHtml(lead.name)},</p><p>${t("Estimated range")}: ${escapeHtml(lead.estimate)}</p><p>${t("Just checking whether you would like to continue with your estimate request.")}</p><p><a href="${escapeHtml(replyUrl)}">${t("Reply to the business to discuss your request.")}</a></p><p>${t("This is a preliminary estimate, not a confirmed booking or payment.")}</p><p><a href="${escapeHtml(unsubscribeUrl)}">${t("Unsubscribe from reminders")}</a></p></div>`,
  };
}
