export const config = { schedule: "*/5 * * * *" };
export default async function calendars() {
  const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!origin || !secret || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const response = await fetch(new URL("/api/internal/calendars", origin), {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(28000),
  });
  if (!response.ok) throw new Error(`Calendar worker returned ${response.status}`);
}
