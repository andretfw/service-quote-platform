export const config = { schedule: "*/15 * * * *" };

export default async function followups() {
  const origin = process.env.NEXT_PUBLIC_APP_URL || process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!origin || !secret) throw new Error("Follow-up scheduling is not configured");
  const response = await fetch(new URL("/api/internal/followups", origin), {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`Follow-up worker returned ${response.status}`);
}
