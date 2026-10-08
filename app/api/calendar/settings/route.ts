import { assertRateLimit } from "@/lib/server/rate-limit";
import { z } from "zod";
import { requireWorkspace, requireFeature } from "@/lib/server/workspace";
import { assertSameOrigin, parseJson, publicApiError } from "@/lib/server/http";
import { validTimezone } from "@/lib/calendar";
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "calendar-settings", 30, 3600);
    const workspace = await requireWorkspace(true);
    requireFeature(workspace.plan, "bookings");
    const body = await parseJson(
      request,
      z
        .object({
          timezone: z.string().min(1).max(100).refine(validTimezone),
          duration_minutes: z.number().int().min(15).max(1440),
          weekdays: z.array(z.number().int().min(0).max(6)).max(7),
          opens_at: z.string().regex(/^\d{2}:\d{2}$/),
          closes_at: z.string().regex(/^\d{2}:\d{2}$/),
          enforce_hours: z.boolean(),
        })
        .refine(
          (v) =>
            v.opens_at < v.closes_at &&
            /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.opens_at) &&
            /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.closes_at) &&
            (!v.enforce_hours || v.weekdays.length > 0),
        ),
    );
    const result = await workspace.db
      .from("booking_settings")
      .upsert({ organization_id: workspace.organizationId, ...body });
    if (result.error) throw result.error;
    return Response.json({ ok: true });
  } catch (error) {
    const result = publicApiError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
