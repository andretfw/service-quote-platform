import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { requireWorkspace, requireFeature } from "@/lib/server/workspace";
import { assertSameOrigin, publicApiError } from "@/lib/server/http";
import { calendarProvider, calendarAuthorization } from "@/lib/server/calendar-provider";
import { encryptCalendarSecret } from "@/lib/server/calendar-security";
import { assertRateLimit } from "@/lib/server/rate-limit";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "calendar-connect", 10, 3600);
    const workspace = await requireWorkspace(true);
    requireFeature(workspace.plan, "bookings");
    const provider = calendarProvider((await params).provider);
    const state = randomBytes(32).toString("base64url"),
      verifier = randomBytes(32).toString("base64url");
    const url = calendarAuthorization(provider, state, verifier);
    const { error } = await workspace.db.from("calendar_oauth_states").insert({
      id: state,
      organization_id: workspace.organizationId,
      user_id: workspace.user.id,
      provider,
      verifier: encryptCalendarSecret(verifier, state),
      expires_at: new Date(Date.now() + 600000).toISOString(),
    });
    if (error) throw error;
    (await cookies()).set(`sq_calendar_${provider}`, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: `/api/calendar/${provider}/callback`,
      maxAge: 600,
    });
    return Response.json({ url }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const result = publicApiError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
