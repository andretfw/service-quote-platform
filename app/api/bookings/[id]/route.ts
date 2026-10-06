import { z } from "zod";
import { requireWorkspace } from "@/lib/server/workspace";
import { assertSameOrigin, parseJson, publicApiError } from "@/lib/server/http";
import { assertRateLimit } from "@/lib/server/rate-limit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "booking-status", 60, 600);
    const workspace = await requireWorkspace();
    const { id } = await params;
    const { status } = await parseJson(
      request,
      z.object({ status: z.enum(["confirmed", "cancelled", "completed"]) }),
    );
    const { error } = await workspace.db.rpc("resolve_booking", {
      p_organization_id: workspace.organizationId,
      p_booking_id: id,
      p_status: status,
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    const result = publicApiError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
