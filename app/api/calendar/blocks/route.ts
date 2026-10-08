import { assertRateLimit } from "@/lib/server/rate-limit";
import { calendarApiError } from "@/lib/server/calendar";
import { z } from "zod";
import { requireWorkspace, requireFeature } from "@/lib/server/workspace";
import { assertSameOrigin, parseJson } from "@/lib/server/http";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "calendar-block", 100, 3600);
    const workspace = await requireWorkspace(true);
    requireFeature(workspace.plan, "bookings");
    const body = await parseJson(
      request,
      z
        .object({
          startsAt: z.iso.datetime({ offset: true }),
          endsAt: z.iso.datetime({ offset: true }),
          label: z.string().trim().min(1).max(160),
        })
        .refine(
          (v) =>
            Date.parse(v.endsAt) > Date.parse(v.startsAt) &&
            Date.parse(v.endsAt) <= Date.parse(v.startsAt) + 366 * 86400000,
        ),
    );
    const result = await workspace.db.rpc("create_calendar_block", {
      p_org: workspace.organizationId,
      p_start: body.startsAt,
      p_end: body.endsAt,
      p_label: body.label,
    });
    if (result.error) throw result.error;
    return Response.json({ ok: true });
  } catch (error) {
    const result = calendarApiError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "calendar-unblock", 100, 3600);
    const workspace = await requireWorkspace(true);
    const body = await parseJson(request, z.object({ id: z.uuid() }));
    const result = await workspace.db
      .from("calendar_blocks")
      .delete()
      .eq("id", body.id)
      .eq("organization_id", workspace.organizationId);
    if (result.error) throw result.error;
    return Response.json({ ok: true });
  } catch (error) {
    const result = calendarApiError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
