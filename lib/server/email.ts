import "server-only";

type Email = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
  headers?: Record<string, string>;
};

export async function sendEmail(
  apiKey: string,
  email: Email,
  idempotencyKey: string,
  deadline: number,
) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error("Email worker deadline reached");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(email),
    signal: AbortSignal.timeout(Math.min(6000, remaining)),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  const result = (await response.json()) as { id?: string };
  if (!result.id) throw new Error("Email provider did not acknowledge the message");
  return result.id;
}
