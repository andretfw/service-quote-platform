import { z } from "zod";
import { assertSameOrigin, HttpError, parseJson, publicApiError } from "@/lib/server/http";
import { requireCalculator } from "@/lib/server/workspace";
import { assertRateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "calculator-archive", 30, 600);
    const { id } = await params;
    const workspace = await requireCalculator(id);
    const { archived } = await parseJson(request, z.object({ archived: z.boolean() }));
    const { error } = await workspace.db.rpc("set_calculator_archived", {
      p_organization_id: workspace.organizationId,
      p_calculator_id: id,
      p_archived: archived,
    });
    if (error) {
      if (error.code === "P0001") throw new HttpError(402, error.message);
      throw error;
    }
    return Response.json({ url: "/workspace" });
  } catch (error) {
    const result = publicApiError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
