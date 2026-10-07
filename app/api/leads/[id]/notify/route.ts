import { z } from "zod";
import { NextResponse } from "next/server";
import { requireWorkspace, requireFeature } from "@/lib/server/workspace";
import { workspaceLead } from "@/lib/server/lead-details";
import { assertSameOrigin, HttpError, publicApiError } from "@/lib/server/http";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { attemptLeadNotification, emailAlertsConfigured } from "@/lib/server/notifications";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "notification-retry", 5, 600);
    const workspace = await requireWorkspace();
    requireFeature(workspace.plan);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new HttpError(404, "Enquiry not found");
    const lead = await workspaceLead(workspace, id);
    if (!lead) throw new HttpError(404, "Enquiry not found");
    if (!emailAlertsConfigured()) throw new HttpError(503, "Email alerts are not configured");
    return NextResponse.json({ ok: true, ...(await attemptLeadNotification(id)) });
  } catch (error) {
    const result = publicApiError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
