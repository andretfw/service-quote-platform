import { authorizedWorker } from "@/lib/server/cron";
import { sendLeadIntegrations } from "@/lib/server/integrations";
import { databaseConfigured } from "@/lib/server/env";
export async function POST(request: Request) {
  if (!authorizedWorker(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured())
    return Response.json({ error: "Database is not configured" }, { status: 503 });
  try {
    return Response.json({ ok: true, ...(await sendLeadIntegrations()) });
  } catch {
    return Response.json({ error: "Integration delivery could not be completed" }, { status: 500 });
  }
}
