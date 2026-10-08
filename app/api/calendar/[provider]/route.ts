import { assertRateLimit } from "@/lib/server/rate-limit";
import { requireWorkspace, requireFeature } from "@/lib/server/workspace";
import { assertSameOrigin, publicApiError } from "@/lib/server/http";
import { calendarProvider } from "@/lib/server/calendar-provider";
import { retryCalendar } from "@/lib/server/calendar";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "calendar-disconnect", 20, 3600);
    const workspace = await requireWorkspace(true);
    const provider = calendarProvider((await params).provider);
    const result = await workspace.db
      .from("calendar_connections")
      .delete()
      .eq("organization_id", workspace.organizationId)
      .eq("provider", provider);
    if (result.error) throw result.error;
    return Response.json({ ok: true });
  } catch (error) {
    const result = publicApiError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "calendar-retry", 20, 3600);
    const workspace = await requireWorkspace(true);
    requireFeature(workspace.plan, "bookings");
    await retryCalendar(workspace.organizationId, calendarProvider((await params).provider));
    return Response.json({ ok: true });
  } catch (error) {
    const result = publicApiError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
