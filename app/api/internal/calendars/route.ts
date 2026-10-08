import { authorizedWorker } from "@/lib/server/cron";
import { syncCalendars } from "@/lib/server/calendar";
export async function POST(request: Request) {
  if (!authorizedWorker(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json({ ok: true, ...(await syncCalendars()) });
  } catch {
    return Response.json({ error: "Unable to synchronize calendars" }, { status: 503 });
  }
}
