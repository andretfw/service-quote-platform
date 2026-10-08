import { translate, validLocale } from "@/lib/i18n";
import { unsubscribeToken } from "@/lib/unsubscribe";
import { getAppUrl } from "@/lib/server/env";
import { customerCalculator } from "@/lib/server/customer-calculator";
import { sendLeadNotifications } from "@/lib/server/notifications";
import { authorizedWorker } from "@/lib/server/cron";
import { NextResponse } from "next/server";
import { emailConfiguration, sendEmail } from "@/lib/server/email";
import { escapeHtml } from "@/lib/server/security";
import { createAdminClient } from "@/lib/supabase/admin";

const FOLLOW_UP_DELAYS_DAYS = [3, 7, null] as const;
const CLAIM_MINUTES = 10;
const RETRY_MINUTES = 60;

export async function POST(request: Request) {
  if (!authorizedWorker(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = emailConfiguration();
  if (!config || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Email delivery is not configured" }, { status: 503 });
  }

  const deadline = Date.now() + 18000;
  const db = createAdminClient();
  await db.rpc("cleanup_rate_limits", {});
  const notifications = await sendLeadNotifications(
    config.apiKey,
    config.from,
    Math.min(deadline, Date.now() + 8000),
  );
  const now = new Date();
  const nowIso = now.toISOString();

  const { data, error } = await db
    .from("submissions")
    .select("id,calculator_id,lead_name,lead_email,status,follow_up_count,next_follow_up_at,quote")
    .lte("next_follow_up_at", nowIso)
    .not("lead_email", "is", null)
    .eq("follow_up_consent", true)
    .in("status", ["new", "contacted"])
    .order("next_follow_up_at", { ascending: true })
    .limit(10);

  if (error) return NextResponse.json({ error: "Unable to load follow-ups" }, { status: 500 });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const lead of data ?? []) {
    if (Date.now() >= deadline) break;
    const unsubscribeSecret = process.env.UNSUBSCRIBE_SECRET?.trim();
    if (!unsubscribeSecret) {
      skipped += 1;
      continue;
    }
    let calculator;
    try {
      calculator = await customerCalculator(lead.calculator_id, "followUps");
    } catch {
      skipped += 1;
      continue;
    }
    if (!calculator.template.settings?.followUps) {
      skipped += 1;
      continue;
    }
    const unsubscribeUrl = `${getAppUrl("http://localhost:3000")}/unsubscribe?token=${encodeURIComponent(unsubscribeToken(lead.id, unsubscribeSecret))}`;
    const oneClickUrl = unsubscribeUrl.replace("/unsubscribe?", "/api/public/unsubscribe?");
    const email = lead.lead_email;
    if (!email) {
      skipped += 1;
      continue;
    }

    const followUpCount = Number(lead.follow_up_count ?? 0);
    const claimUntil = new Date(Date.now() + CLAIM_MINUTES * 60 * 1000).toISOString();

    const { data: claimed, error: claimError } = await db
      .from("submissions")
      .update({ next_follow_up_at: claimUntil })
      .eq("id", lead.id)
      .eq("follow_up_count", followUpCount)
      .eq("follow_up_consent", true)
      .lte("next_follow_up_at", nowIso)
      .in("status", ["new", "contacted"])
      .select("id")
      .maybeSingle();

    if (claimError) {
      failed += 1;
      continue;
    }
    if (!claimed) {
      skipped += 1;
      continue;
    }

    const quote = lead.quote as Record<string, unknown> | null;
    const locale = validLocale(quote?.locale ?? calculator.template.settings?.locale);
    const t = (text: string) => translate(text, locale);
    try {
      await sendEmail(
        config.apiKey,
        {
          from: config.from,
          to: email,
          subject: t("Still interested in your estimate?"),
          headers: {
            "List-Unsubscribe": `<${oneClickUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          text: `${t("Hi")} ${lead.lead_name},\n\n${t("Just checking whether you would like to continue with your estimate request.")}\n\n${t("Unsubscribe from reminders")}: ${unsubscribeUrl}`,
          html: `<p>${t("Hi")} ${escapeHtml(String(lead.lead_name))},</p><p>${t("Just checking whether you would like to continue with your estimate request.")}</p><p><a href="${escapeHtml(unsubscribeUrl)}">${t("Unsubscribe from reminders")}</a></p>`,
        },
        `quote-follow-up/${lead.id}/${followUpCount}`,
        deadline,
      );
    } catch {
      const retryAt = new Date(Date.now() + RETRY_MINUTES * 60 * 1000).toISOString();
      await db
        .from("submissions")
        .update({ next_follow_up_at: retryAt })
        .eq("id", lead.id)
        .eq("follow_up_count", followUpCount)
        .eq("follow_up_consent", true)
        .in("status", ["new", "contacted"]);
      failed += 1;
      continue;
    }

    const delayDays = FOLLOW_UP_DELAYS_DAYS[followUpCount] ?? null;
    const nextFollowUpAt = delayDays
      ? new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error: updateError } = await db
      .from("submissions")
      .update({
        status: "contacted",
        follow_up_count: followUpCount + 1,
        next_follow_up_at: nextFollowUpAt,
      })
      .eq("id", lead.id)
      .eq("follow_up_count", followUpCount)
      .eq("follow_up_consent", true)
      .in("status", ["new", "contacted"]);

    if (updateError) {
      failed += 1;
      continue;
    }

    sent += 1;
  }

  return NextResponse.json({
    ok: true,
    notifications: notifications.sent,
    notificationFailures: notifications.failed,
    sent,
    failed,
    skipped,
  });
}
