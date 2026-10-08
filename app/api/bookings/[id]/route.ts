import { assertExternalAvailability, calendarApiError } from "@/lib/server/calendar";
import { HttpError } from "@/lib/server/http";
import { z } from "zod";
import { requireWorkspace } from "@/lib/server/workspace";
import { assertSameOrigin, parseJson } from "@/lib/server/http";
import { assertRateLimit } from "@/lib/server/rate-limit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "booking-status", 60, 600);
    const workspace = await requireWorkspace();
    const { id } = await params;
    const body = await parseJson(
      request,
      z.union([
        z.object({ status: z.enum(["confirmed", "cancelled", "completed"]) }),
        z.object({
          startsAt: z.iso.datetime({ offset: true }),
          endsAt: z.iso.datetime({ offset: true }),
        }),
      ]),
    );
    const booking = await workspace.db
      .from("bookings")
      .select("id,starts_at,ends_at,submission_id")
      .eq("id", id)
      .single();
    if (booking.error) throw new HttpError(404, "Booking not found");
    const lead = await workspace.db
      .from("submissions")
      .select("calculator_id")
      .eq("id", booking.data.submission_id)
      .single();
    if (lead.error) throw new HttpError(404, "Booking not found");
    const calculator = await workspace.db
      .from("calculators")
      .select("id")
      .eq("id", lead.data.calculator_id)
      .eq("organization_id", workspace.organizationId)
      .maybeSingle();
    if (calculator.error || !calculator.data) throw new HttpError(404, "Booking not found");
    if ("startsAt" in body) {
      await assertExternalAvailability(workspace.organizationId, body.startsAt, body.endsAt, id);
      const changed = await workspace.db.rpc("reschedule_booking", {
        p_org: workspace.organizationId,
        p_id: id,
        p_start: body.startsAt,
        p_end: body.endsAt,
      });
      if (changed.error) throw changed.error;
      return Response.json({ ok: true });
    }
    if (body.status === "confirmed")
      await assertExternalAvailability(
        workspace.organizationId,
        booking.data.starts_at,
        booking.data.ends_at,
        id,
      );
    const { error } = await workspace.db.rpc("resolve_booking", {
      p_organization_id: workspace.organizationId,
      p_booking_id: id,
      p_status: body.status,
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    const result = calendarApiError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
