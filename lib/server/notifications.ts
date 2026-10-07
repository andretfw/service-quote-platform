import "server-only";
import { emailConfiguration, sendEmail } from "./email";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "./env";
import { leadColumns, leadPresentation } from "./lead-details";
import { leadNotificationMessage } from "./notification-message";

export const emailAlertsConfigured = () => Boolean(emailConfiguration());

export async function sendLeadNotifications(
  apiKey: string,
  from: string,
  deadline: number,
  submissionId?: string,
) {
  const db = createAdminClient();
  const now = new Date().toISOString();
  let query = db
    .from("notification_outbox")
    .select("id,submission_id,recipient")
    .is("sent_at", null)
    .lte("retry_at", now)
    .order("retry_at")
    .limit(10);
  if (submissionId) query = query.eq("submission_id", submissionId);
  const { data, error } = await query;
  if (error) throw error;
  let sent = 0;
  let failed = 0;
  for (const notification of data) {
    if (Date.now() >= deadline) break;
    const claimUntil = new Date(Date.now() + 600000).toISOString();
    const { data: claimed, error: claimError } = await db
      .from("notification_outbox")
      .update({ retry_at: claimUntil })
      .eq("id", notification.id)
      .is("sent_at", null)
      .lte("retry_at", now)
      .select("id")
      .maybeSingle();
    if (claimError) {
      failed += 1;
      continue;
    }
    if (!claimed) continue;
    try {
      const { data: lead, error: leadError } = await db
        .from("submissions")
        .select(leadColumns)
        .eq("id", notification.submission_id)
        .maybeSingle();
      if (leadError) throw leadError;
      if (!lead) continue;
      const presentation = await leadPresentation(db, lead);
      await sendEmail(
        apiKey,
        {
          from,
          to: notification.recipient,
          ...leadNotificationMessage(
            {
              id: lead.id,
              name: lead.lead_name,
              email: lead.lead_email,
              phone: lead.lead_phone,
              calculatorName: presentation.name,
              estimate: presentation.estimate,
              answers: presentation.answers,
            },
            getAppUrl("http://localhost:3000"),
            presentation.locale,
          ),
        },
        `lead-notification/${notification.id}`,
        deadline,
      );
      const { error: updateError } = await db
        .from("notification_outbox")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", notification.id)
        .eq("retry_at", claimUntil);
      if (updateError) throw updateError;
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
}

export async function attemptLeadNotification(submissionId: string) {
  const config = emailConfiguration();
  if (!config) return { sent: 0, failed: 0 };
  try {
    return await sendLeadNotifications(config.apiKey, config.from, Date.now() + 5000, submissionId);
  } catch {
    return { sent: 0, failed: 1 };
  }
}
