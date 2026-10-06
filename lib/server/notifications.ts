import "server-only";
import { sendEmail } from "./email";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml } from "./security";
import { getAppUrl } from "./env";

export async function sendLeadNotifications(apiKey: string, from: string, deadline: number) {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("notification_outbox")
    .select("id,submission_id,recipient")
    .is("sent_at", null)
    .lte("retry_at", now)
    .order("retry_at")
    .limit(10);
  if (error) throw error;
  let sent = 0;
  for (const notification of data) {
    if (Date.now() >= deadline) break;
    const { data: claimed, error: claimError } = await db
      .from("notification_outbox")
      .update({ retry_at: new Date(Date.now() + 600000).toISOString() })
      .eq("id", notification.id)
      .is("sent_at", null)
      .lte("retry_at", now)
      .select("id")
      .maybeSingle();
    if (claimError || !claimed) continue;
    const { data: lead, error: leadError } = await db
      .from("submissions")
      .select("lead_name")
      .eq("id", notification.submission_id)
      .maybeSingle();
    if (leadError) throw leadError;
    if (!lead) continue;
    try {
      await sendEmail(
        apiKey,
        {
          from,
          to: notification.recipient,
          subject: "New quote request",
          html: `<p>${escapeHtml(lead.lead_name)} submitted a quote request.</p><p><a href="${escapeHtml(getAppUrl("http://localhost:3000"))}/leads">Open your lead dashboard</a></p>`,
        },
        `lead-notification/${notification.id}`,
        deadline,
      );
      const { error: updateError } = await db
        .from("notification_outbox")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", notification.id);
      if (updateError) throw updateError;
      sent += 1;
    } catch {
      continue;
    }
  }
  return sent;
}
