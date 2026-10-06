import "server-only";
import { createHash } from "node:crypto";
import { databaseConfigured } from "@/lib/server/env";
import { HttpError } from "@/lib/server/http";
import { createAdminClient } from "@/lib/supabase/admin";

const clientAddress = (request: Request): string => {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
};

export async function assertRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  if (!databaseConfigured()) return;

  const secret = process.env.RATE_LIMIT_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RATE_LIMIT_SECRET is required in production");
    }
    return;
  }

  const key = createHash("sha256")
    .update(`${secret}\u0000${scope}\u0000${clientAddress(request)}`, "utf8")
    .digest("hex");

  const db = createAdminClient();
  const { data, error } = await db.rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) throw error;
  if (data !== true) throw new HttpError(429, "Too many requests. Please try again shortly.");
}
