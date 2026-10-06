import { createHmac, timingSafeEqual } from "node:crypto";

export function unsubscribeToken(id: string, secret: string, now = Date.now()): string {
  const payload = `${id}.${Math.floor(now / 1000) + 90 * 86400}`;
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function verifyUnsubscribeToken(
  token: string,
  secret: string,
  now = Date.now(),
): string | null {
  const [id, expires, signature, extra] = token.split(".");
  if (
    extra ||
    !id ||
    !/^[0-9a-f-]{36}$/i.test(id) ||
    !/^\d{10}$/.test(expires ?? "") ||
    !signature ||
    Number(expires) <= Math.floor(now / 1000)
  )
    return null;
  const expected = createHmac("sha256", secret).update(`${id}.${expires}`).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}
