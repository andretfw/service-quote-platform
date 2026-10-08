import { cookies } from "next/headers";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireWorkspace, requireFeature } from "@/lib/server/workspace";
import { calendarProvider, calendarConfig, calendarTokens } from "@/lib/server/calendar-provider";
import { encryptCalendarSecret, decryptCalendarSecret } from "@/lib/server/calendar-security";
import { getAppUrl } from "@/lib/server/env";
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const origin = getAppUrl(new URL(request.url).origin);
  let ok = false;
  const provider = calendarProvider((await params).provider);
  const jar = await cookies();
  const name = `sq_calendar_${provider}`;
  const expected = jar.get(name)?.value;
  jar.delete({ name, path: `/api/calendar/${provider}/callback` });
  try {
    const workspace = await requireWorkspace(true);
    requireFeature(workspace.plan, "bookings");
    const url = new URL(request.url),
      state = url.searchParams.get("state") ?? "",
      code = url.searchParams.get("code");
    if (
      !expected ||
      !/^[A-Za-z0-9_-]{43}$/.test(state) ||
      state.length !== expected.length ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(expected))
    )
      throw new Error("Invalid authorization state");
    // Atomic delete consumes the state once, even if provider exchange fails.
    const consumed = await workspace.db
      .from("calendar_oauth_states")
      .delete()
      .eq("id", state)
      .eq("organization_id", workspace.organizationId)
      .eq("user_id", workspace.user.id)
      .eq("provider", provider)
      .gt("expires_at", new Date().toISOString())
      .select("verifier")
      .maybeSingle();
    if (
      consumed.error ||
      !consumed.data ||
      !code ||
      code.length > 4096 ||
      url.searchParams.has("error")
    )
      throw new Error("Authorization was not completed");
    const config = calendarConfig(provider);
    const tokens = await calendarTokens(provider, {
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      code_verifier: decryptCalendarSecret(consumed.data.verifier, state),
    });
    const scopes = (tokens.scope ?? "").toLowerCase();
    if (
      !tokens.refresh_token ||
      !(provider === "google"
        ? scopes.includes("calendar.events")
        : scopes.includes("calendars.readwrite"))
    )
      throw new Error("Required calendar permission was not granted");
    const result = await workspace.db.from("calendar_connections").upsert({
      organization_id: workspace.organizationId,
      provider,
      refresh_token: encryptCalendarSecret(
        tokens.refresh_token,
        `${workspace.organizationId}/${provider}`,
      ),
      revision: randomUUID(),
      connected_at: new Date().toISOString(),
    });
    if (result.error) throw result.error;
    ok = true;
  } catch {
    ok = false;
  }
  const response = NextResponse.redirect(
    `${origin}/calendar?calendar=${ok ? "connected" : "error"}`,
  );
  response.headers.set("cache-control", "no-store");
  response.headers.set("referrer-policy", "no-referrer");
  return response;
}
