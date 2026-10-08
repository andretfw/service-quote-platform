import { sendCustomerReminders } from "@/lib/server/reminders";
import { sendLeadNotifications } from "@/lib/server/notifications";
import { authorizedWorker } from "@/lib/server/cron";
import { NextResponse } from "next/server";
import { emailConfiguration } from "@/lib/server/email";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!authorizedWorker(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = emailConfiguration();
  if (!config || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return NextResponse.json({ error: "Email delivery is not configured" }, { status: 503 });
  try {
    const deadline = Date.now() + 18000;
    const { error } = await createAdminClient().rpc("cleanup_rate_limits", {});
    if (error) throw error;
    const notifications = await sendLeadNotifications(
      config.apiKey,
      config.from,
      Math.min(deadline, Date.now() + 8000),
    );
    const reminders = await sendCustomerReminders(config.apiKey, config.from, deadline);
    return NextResponse.json({
      ok: true,
      notifications: notifications.sent,
      notificationFailures: notifications.failed,
      ...reminders,
    });
  } catch {
    return NextResponse.json({ error: "Unable to process scheduled emails" }, { status: 500 });
  }
}
