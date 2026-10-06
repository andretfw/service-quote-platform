import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { escapeHtml } from "@/lib/server/security";
import { createAdminClient } from "@/lib/supabase/admin";

const FOLLOW_UP_DELAYS_DAYS = [3, 7, null] as const;
const CLAIM_MINUTES = 10;
const RETRY_MINUTES = 60;

const secretsMatch = (provided: string | null, expected: string): boolean => {
  if (!provided) return false;
  const expectedHeader = `Bearer ${expected}`;
  const left = Buffer.from(provided);
  const right = Buffer.from(expectedHeader);
  return left.length === right.length && timingSafeEqual(left, right);
};

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || !secretsMatch(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!resendApiKey || !from || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Follow-up integrations are not configured" },
      { status: 503 },
    );
  }

  const db = createAdminClient();
  const resend = new Resend(resendApiKey);
  const now = new Date();
  const nowIso = now.toISOString();

  const { data, error } = await db
    .from("submissions")
    .select("id,lead_name,lead_email,status,follow_up_count,next_follow_up_at")
    .lte("next_follow_up_at", nowIso)
    .not("lead_email", "is", null)
    .in("status", ["new", "contacted"])
    .order("next_follow_up_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: "Unable to load follow-ups" }, { status: 500 });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const lead of data ?? []) {
    const email = lead.lead_email;
    if (!email) {
      skipped += 1;
      continue;
    }

    const followUpCount = Number(lead.follow_up_count ?? 0);
    const claimUntil = new Date(Date.now() + CLAIM_MINUTES * 60 * 1000).toISOString();

    // Optimistic claim prevents overlapping cron invocations from sending the
    // same follow-up. Only one worker can move the exact due row forward.
    const { data: claimed, error: claimError } = await db
      .from("submissions")
      .update({ next_follow_up_at: claimUntil })
      .eq("id", lead.id)
      .eq("follow_up_count", followUpCount)
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

    const result = await resend.emails.send(
      {
        from,
        to: email,
        subject: "Still interested in your estimate?",
        html: `<p>Hi ${escapeHtml(String(lead.lead_name))},</p><p>Just checking whether you would like to continue with your estimate request.</p>`,
      },
      {
        // Resend retains idempotency keys for 24 hours, which covers retries
        // and overlapping workers for the same follow-up sequence.
        idempotencyKey: `quote-follow-up/${lead.id}/${followUpCount}`,
      },
    );

    if (result.error) {
      const retryAt = new Date(Date.now() + RETRY_MINUTES * 60 * 1000).toISOString();
      await db
        .from("submissions")
        .update({ next_follow_up_at: retryAt })
        .eq("id", lead.id)
        .eq("follow_up_count", followUpCount)
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
      .in("status", ["new", "contacted"]);

    if (updateError) {
      failed += 1;
      continue;
    }

    sent += 1;
  }

  return NextResponse.json({ ok: true, sent, failed, skipped });
}
