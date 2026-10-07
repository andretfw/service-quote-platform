import "server-only";
import nodemailer from "nodemailer";
import { createHash } from "node:crypto";

export function emailConfiguration() {
  const provider = process.env.EMAIL_PROVIDER?.trim() || "resend";
  if (provider === "gmail") {
    const user = process.env.GMAIL_USER?.trim();
    const password = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
    if (!user || !/^[^\s<>@]+@gmail\.com$/i.test(user) || !password || password.length !== 16)
      return null;
    return { provider, apiKey: "", from: `Service Quote <${user}>`, user, password };
  }
  if (provider !== "resend") return null;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  return apiKey && from ? { provider, apiKey, from } : null;
}

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
  if (process.env.EMAIL_PROVIDER?.trim() === "gmail") {
    const config = emailConfiguration();
    if (!config || config.provider !== "gmail" || !("user" in config)) {
      throw new Error("Gmail delivery is not configured");
    }
    const timeout = Math.min(6000, remaining);
    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: timeout,
      greetingTimeout: timeout,
      socketTimeout: timeout,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    const timer = setTimeout(() => transport.close(), timeout);
    try {
      const result = await transport.sendMail({
        from: config.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: email.reply_to,
        headers: email.headers,
        messageId: `<${createHash("sha256").update(idempotencyKey).digest("hex")}@gmail.com>`,
      });
      if (!result.accepted?.length || result.rejected?.length) {
        throw new Error("Gmail did not accept the recipient");
      }
      return result.messageId;
    } finally {
      clearTimeout(timer);
      transport.close();
    }
  }
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
