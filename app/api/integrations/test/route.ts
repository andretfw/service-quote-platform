import { randomUUID } from "node:crypto";
import { assertSameOrigin, HttpError, publicApiError } from "@/lib/server/http";
import { requireWorkspace, requireFeature } from "@/lib/server/workspace";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { deliverIntegration, leadIntegrationPayload } from "@/lib/server/integrations";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const workspace = await requireWorkspace();
    if (workspace.role !== "owner")
      throw new HttpError(403, "Only the workspace owner can manage connections");
    requireFeature(workspace.plan, "integrations");
    await assertRateLimit(request, "integration-test", 10, 3600);
    const { data, error } = await workspace.db
      .from("workspace_integrations")
      .select("endpoint_url")
      .eq("organization_id", workspace.organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(400, "Save a connection before testing");
    const id = randomUUID();
    const result = await deliverIntegration(data.endpoint_url, {
      ...leadIntegrationPayload(
        id,
        {
          id,
          created_at: new Date().toISOString(),
          lead_name: "Sample customer",
          lead_email: "sample@example.test",
          lead_phone: null,
          answers: { service: "Sample service", area: 50 },
          quote: { low: 100, high: 120, currency: "EUR" },
        },
        { public_id: "sample-calculator", name: "Sample calculator" },
      ),
      test: true,
    });
    if (!result.ok)
      throw new HttpError(
        502,
        "Your automation tool did not accept the sample. Check its webhook settings.",
      );
    return Response.json({ ok: true });
  } catch (error) {
    const result = publicApiError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
