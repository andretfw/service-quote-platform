import "server-only";
import { calendarMidnight, type CalendarProvider } from "@/lib/calendar";
import { HttpError } from "./http";
import { getAppUrl } from "./env";
import {
  calendarChallenge,
  calendarEventId,
  decryptCalendarSecret,
  encryptCalendarSecret,
} from "./calendar-security";
import { createAdminClient } from "@/lib/supabase/admin";
export function calendarProvider(value: string): CalendarProvider {
  if (value !== "google" && value !== "outlook")
    throw new HttpError(400, "Invalid calendar provider");
  return value;
}
export function calendarConfig(provider: CalendarProvider) {
  const prefix = provider === "google" ? "GOOGLE_CALENDAR" : "MICROSOFT_CALENDAR";
  const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim();
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]?.trim();
  if (
    !clientId ||
    !clientSecret ||
    !/^[a-fA-F0-9]{64}$/.test(process.env.CALENDAR_ENCRYPTION_KEY?.trim() ?? "")
  )
    throw new HttpError(503, "Calendar connections are not configured");
  const redirectUri = `${getAppUrl("http://localhost:3000")}/api/calendar/${provider}/callback`;
  return {
    clientId,
    clientSecret,
    redirectUri,
    authorize:
      provider === "google"
        ? "https://accounts.google.com/o/oauth2/v2/auth"
        : "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    token:
      provider === "google"
        ? "https://oauth2.googleapis.com/token"
        : "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope:
      provider === "google"
        ? "https://www.googleapis.com/auth/calendar.events"
        : "offline_access https://graph.microsoft.com/Calendars.ReadWrite",
  };
}
export function calendarAuthorization(provider: CalendarProvider, state: string, verifier: string) {
  const config = calendarConfig(provider);
  const url = new URL(config.authorize);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scope,
    state,
    code_challenge: calendarChallenge(verifier),
    code_challenge_method: "S256",
    ...(provider === "google"
      ? { access_type: "offline", prompt: "consent" }
      : { prompt: "select_account" }),
  }).toString();
  return url.href;
}
function requestSignal(deadline: number) {
  if (deadline <= Date.now()) throw new Error("Calendar request timed out");
  return AbortSignal.timeout(Math.min(8000, deadline - Date.now()));
}
export async function calendarTokens(
  provider: CalendarProvider,
  fields: Record<string, string>,
  deadline = Date.now() + 20000,
) {
  const config = calendarConfig(provider);
  const response = await fetch(config.token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...fields,
    }),
    redirect: "error",
    signal: requestSignal(deadline),
    cache: "no-store",
  });
  if (!response.ok) throw new HttpError(503, "Reconnect your calendar and try again");
  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
  };
  if (!data.access_token) throw new HttpError(503, "Calendar authorization failed");
  return data;
}
export async function calendarAccess(
  organizationId: string,
  provider: CalendarProvider,
  deadline = Date.now() + 20000,
  expectedRevision?: string,
) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("calendar_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .single();
  if (error || !data) throw new HttpError(503, "Reconnect your calendar and try again");
  if (expectedRevision && data.revision !== expectedRevision)
    throw new Error("Calendar connection changed");
  const context = `${organizationId}/${provider}`;
  const tokens = await calendarTokens(
    provider,
    {
      grant_type: "refresh_token",
      refresh_token: decryptCalendarSecret(data.refresh_token, context),
    },
    deadline,
  );
  if (tokens.refresh_token) {
    const saved = await db
      .from("calendar_connections")
      .update({ refresh_token: encryptCalendarSecret(tokens.refresh_token, context) })
      .eq("organization_id", organizationId)
      .eq("provider", provider)
      .eq("revision", data.revision)
      .eq("refresh_token", data.refresh_token);
    if (saved.error) throw saved.error;
  }
  const current = await db
    .from("calendar_connections")
    .select("revision")
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .maybeSingle();
  if (current.error || current.data?.revision !== data.revision)
    throw new Error("Calendar connection changed");
  return tokens.access_token!;
}
const apiRoot = (provider: CalendarProvider) =>
  provider === "google"
    ? "https://www.googleapis.com/calendar/v3/calendars/primary/events"
    : "https://graph.microsoft.com/v1.0/me/events";
export async function calendarRequest(
  provider: CalendarProvider,
  token: string,
  url: string,
  method = "GET",
  body?: unknown,
  deadline = Date.now() + 20000,
) {
  // URLs are constructed by this module; redirects and foreign pagination origins are rejected.
  const parsed = new URL(url);
  const root = new URL(apiRoot(provider));
  if (
    parsed.origin !== root.origin ||
    parsed.username ||
    parsed.password ||
    !parsed.pathname.startsWith(provider === "google" ? "/calendar/v3/" : "/v1.0/")
  )
    throw new Error("Invalid calendar API destination");
  return fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      Prefer: 'outlook.timezone="UTC", IdType="ImmutableId"',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: "error",
    signal: requestSignal(deadline),
    cache: "no-store",
  });
}
type ProviderEvent = {
  id?: string;
  status?: string;
  transparency?: string;
  showAs?: string;
  isCancelled?: boolean;
  transactionId?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};
export async function providerBusy(
  organizationId: string,
  provider: CalendarProvider,
  start: string,
  end: string,
  ignoreId?: string,
  ignoreBookingId?: string,
  deadline = Date.now() + 20000,
) {
  const token = await calendarAccess(organizationId, provider, deadline);
  const url = new URL(
    provider === "google" ? apiRoot(provider) : "https://graph.microsoft.com/v1.0/me/calendarView",
  );
  url.search = new URLSearchParams(
    provider === "google"
      ? { timeMin: start, timeMax: end, singleEvents: "true", maxResults: "250" }
      : {
          startDateTime: start,
          endDateTime: end,
          $top: "250",
          $select: "id,start,end,showAs,isCancelled,transactionId",
        },
  ).toString();
  const busy: { start: string; end: string }[] = [];
  let next: string | undefined = url.href;
  for (let page = 0; next && page < 10; page++) {
    const response = await calendarRequest(provider, token, next, "GET", undefined, deadline);
    if (!response.ok)
      throw new HttpError(503, "Unable to check calendar availability. Reconnect and try again.");
    const data = (await response.json()) as {
      items?: ProviderEvent[];
      value?: ProviderEvent[];
      nextPageToken?: string;
      "@odata.nextLink"?: string;
      timeZone?: string;
    };
    for (const event of data.items ?? data.value ?? []) {
      if (
        (ignoreId && event.id === ignoreId) ||
        (provider === "outlook" && ignoreBookingId && event.transactionId === ignoreBookingId) ||
        event.status === "cancelled" ||
        event.isCancelled ||
        event.transparency === "transparent" ||
        event.showAs === "free"
      )
        continue;
      const instant = (value: { dateTime?: string; date?: string } | undefined) => {
        if (value?.dateTime)
          return /(?:Z|[+-]\d\d:\d\d)$/.test(value.dateTime)
            ? value.dateTime
            : `${value.dateTime}Z`;
        return value?.date ? `${value.date}T00:00:00Z` : "";
      };
      let from = instant(event.start),
        to = instant(event.end);
      if (provider === "google" && event.start?.date) {
        if (!data.timeZone || !event.end?.date) throw new Error("Missing calendar time zone");
        from = calendarMidnight(event.start.date, data.timeZone);
        to = calendarMidnight(event.end.date, data.timeZone);
      }
      if (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)))
        throw new HttpError(503, "Unable to check calendar availability. Reconnect and try again.");
      busy.push({ start: from, end: to });
    }
    if (provider === "google" && data.nextPageToken) {
      const pageUrl = new URL(url);
      pageUrl.searchParams.set("pageToken", data.nextPageToken);
      next = pageUrl.href;
    } else next = provider === "outlook" ? data["@odata.nextLink"] : undefined;
  }
  if (next) throw new HttpError(503, "Calendar contains too many events to verify this range");
  return busy;
}
export async function writeCalendarBooking(
  organizationId: string,
  provider: CalendarProvider,
  booking: { id: string; starts_at: string; ends_at: string; status: string },
  externalId: string | null,
  deadline = Date.now() + 20000,
  expectedRevision?: string,
) {
  const token = await calendarAccess(organizationId, provider, deadline, expectedRevision);
  const deterministic = calendarEventId(organizationId, booking.id);
  let id = externalId ?? (provider === "google" ? deterministic : null);
  // Recover an Outlook event if a previous worker created it but lost its lease
  // before saving the ID. This also makes cancellation after that race reliable.
  const propertyId = "String {7f6a94c1-e7a1-4cc9-a4fc-0822a20ac721} Name ServiceQuoteBooking";
  const propertyValue = `${organizationId}/${booking.id}`;
  if (provider === "outlook" && !id) {
    const lookup = new URL(apiRoot(provider));
    const quote = (value: string) => value.replaceAll("'", "''");
    lookup.search = new URLSearchParams({
      $filter: `singleValueExtendedProperties/Any(ep: ep/id eq '${propertyId}' and ep/value eq '${quote(propertyValue)}')`,
      $select: "id",
      $top: "2",
    }).toString();
    const response = await calendarRequest(
      provider,
      token,
      lookup.href,
      "GET",
      undefined,
      deadline,
    );
    if (!response.ok) throw new Error("Calendar event lookup failed");
    const found = (await response.json()) as { value?: { id: string }[] };
    if (!Array.isArray(found.value) || found.value.length > 1)
      throw new Error("Calendar event lookup is ambiguous");
    id = found.value[0]?.id ?? null;
  }
  if (booking.status === "cancelled") {
    if (id) {
      const response = await calendarRequest(
        provider,
        token,
        `${apiRoot(provider)}/${encodeURIComponent(id)}`,
        "DELETE",
        undefined,
        deadline,
      );
      if (!response.ok && ![404, 410].includes(response.status))
        throw new Error("Calendar cancellation failed");
    }
    return id;
  }
  const body =
    provider === "google"
      ? {
          summary: "Service booking",
          start: { dateTime: booking.starts_at },
          end: { dateTime: booking.ends_at },
          extendedProperties: { private: { serviceQuoteBooking: booking.id } },
        }
      : {
          subject: "Service booking",
          start: { dateTime: booking.starts_at, timeZone: "UTC" },
          end: { dateTime: booking.ends_at, timeZone: "UTC" },
          showAs: "busy",
        };
  if (id) {
    const response = await calendarRequest(
      provider,
      token,
      `${apiRoot(provider)}/${encodeURIComponent(id)}`,
      "PATCH",
      body,
      deadline,
    );
    if (response.ok) return id;
    if (response.status !== 404 && response.status !== 410)
      throw new Error("Calendar update failed");
  }
  const response = await calendarRequest(
    provider,
    token,
    apiRoot(provider),
    "POST",
    provider === "google"
      ? { ...body, id: deterministic }
      : {
          ...body,
          transactionId: booking.id,
          singleValueExtendedProperties: [{ id: propertyId, value: propertyValue }],
        },
    deadline,
  );
  if (provider === "google" && response.status === 409) {
    const updated = await calendarRequest(
      provider,
      token,
      `${apiRoot(provider)}/${deterministic}`,
      "PATCH",
      body,
      deadline,
    );
    if (updated.ok) return deterministic;
  }
  if (!response.ok) throw new Error("Calendar creation failed");
  const result = (await response.json()) as { id?: string };
  if (!result.id) throw new Error("Calendar event is missing an identifier");
  return result.id;
}
