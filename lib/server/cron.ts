import "server-only";
import { timingSafeEqual } from "node:crypto";
export function authorizedWorker(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const provided = request.headers.get("authorization");
  if (!secret || !provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(`Bearer ${secret}`);
  return left.length === right.length && timingSafeEqual(left, right);
}
