import { z } from "zod";
import { assertSameOrigin, HttpError, parseJson, publicApiError } from "@/lib/server/http";
import { requireWorkspace, requireFeature } from "@/lib/server/workspace";
import { integrationDestination } from "@/lib/integrations";
import { assertRateLimit } from "@/lib/server/rate-limit";
const schema = z.object({ url: z.string().trim().min(1).max(512), enabled: z.boolean() }).strict();
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace();
    if (workspace.role !== "owner")
      throw new HttpError(403, "Only the workspace owner can manage connections");
    await assertRateLimit(request, "integration-save", 20, 3600);
    const body = await parseJson(request, schema);
    if (body.enabled) requireFeature(workspace.plan, "integrations");
    let destination;
    try {
      destination = integrationDestination(body.url);
    } catch {
      throw new HttpError(400, "Use a Zapier Catch Hook or Make custom webhook URL");
    }
    const { error } = await workspace.db.rpc("configure_workspace_integration", {
      p_organization_id: workspace.organizationId,
      p_provider: destination.provider,
      p_url: destination.url,
      p_enabled: body.enabled,
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    const result = publicApiError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
