import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, parseJson, publicApiError } from "@/lib/server/http";
import { requireWorkspace, requireFeature } from "@/lib/server/workspace";
import { assertRateLimit } from "@/lib/server/rate-limit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "lead-status", 60, 600);
    const workspace = await requireWorkspace();
    requireFeature(workspace.plan);
    const { id } = await params;
    const { status } = await parseJson(
      request,
      z.object({ status: z.enum(["new", "contacted", "won", "lost"]) }),
    );
    const { error } = await workspace.db.rpc("set_lead_status", {
      p_organization_id: workspace.organizationId,
      p_submission_id: id,
      p_status: status,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const result = publicApiError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
