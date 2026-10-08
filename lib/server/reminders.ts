import "server-only";
import { validLocale } from "@/lib/i18n";
import { formatEstimate } from "@/lib/lead-summary";
import { unsubscribeToken } from "@/lib/unsubscribe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "./env";
import { sendEmail } from "./email";
import { customerReminderMessage } from "./reminder-message";

type Reminder = {
  id: string;
  claim_token: string;
  follow_up_count: number;
  lead_name: string;
  lead_email: string;
  quote: Record<string, unknown>;
  business_name: string;
  calculator_name: string;
  reply_to: string;
  locale: string | null;
};

export async function sendCustomerReminders(apiKey: string, from: string, deadline: number) {
  const secret = process.env.UNSUBSCRIBE_SECRET?.trim();
  if (!secret) return { sent: 0, failed: 0, skipped: 0 };
  const origin = getAppUrl("http://localhost:3000");
  const db = createAdminClient();
  let sent = 0,
    failed = 0,
    skipped = 0;
  for (let index = 0; index < 10 && Date.now() < deadline - 6500; index++) {
    const { data, error } = await db.rpc("claim_customer_reminders", { p_limit: 1 });
    if (error) throw error;
    const lead = (data as unknown as Reminder[])[0];
    if (!lead) break;
    const finish = (delivered: boolean) =>
      db.rpc("finish_customer_reminder", {
        p_submission_id: lead.id,
        p_claim_token: lead.claim_token,
        p_sent: delivered,
      });
    let accepted = false;
    try {
      const { data: current, error: currentError } = await db
        .from("submissions")
        .select("id")
        .eq("id", lead.id)
        .eq("follow_up_claim_token", lead.claim_token)
        .eq("follow_up_consent", true)
        .not("next_follow_up_at", "is", null)
        .in("status", ["new", "contacted"])
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) {
        skipped++;
        continue;
      }
      const locale = validLocale(lead.quote?.locale ?? lead.locale);
      const unsubscribeUrl = `${origin}/unsubscribe?token=${encodeURIComponent(unsubscribeToken(lead.id, secret))}`;
      await sendEmail(
        apiKey,
        {
          from,
          to: lead.lead_email,
          ...customerReminderMessage(
            {
              name: lead.lead_name,
              business: lead.business_name,
              calculator: lead.calculator_name,
              estimate: formatEstimate(lead.quote, locale),
              replyTo: lead.reply_to,
            },
            unsubscribeUrl,
            locale,
          ),
        },
        `quote-follow-up/${lead.id}/${lead.follow_up_count}`,
        deadline,
      );
      accepted = true;
      const result = await finish(true);
      if (result.error) throw result.error;
      if (result.data) sent++;
      else skipped++;
    } catch {
      if (!accepted) {
        const result = await finish(false);
        if (result.error) throw result.error;
      }
      failed++;
    }
  }
  return { sent, failed, skipped };
}
