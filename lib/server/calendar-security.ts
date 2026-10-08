import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { HttpError } from "./http";
function key() {
  const value = process.env.CALENDAR_ENCRYPTION_KEY?.trim() ?? "";
  if (!/^[a-fA-F0-9]{64}$/.test(value))
    throw new HttpError(503, "Calendar connections are not configured");
  return Buffer.from(value, "hex");
}
export function encryptCalendarSecret(value: string, context: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}
export function decryptCalendarSecret(value: string, context: string) {
  const data = Buffer.from(value, "base64url");
  if (data.length < 29) throw new Error("Invalid encrypted calendar credential");
  const cipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString("utf8");
}
export const calendarChallenge = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url");
export const calendarEventId = (organizationId: string, bookingId: string) =>
  "b" + createHash("sha256").update(`${organizationId}/${bookingId}`).digest("hex");
