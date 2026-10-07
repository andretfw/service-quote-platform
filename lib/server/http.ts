import "server-only";
import { z, type ZodType } from "zod";
import { QuoteValidationError } from "@/lib/pricing-engine";

const DEFAULT_MAX_BYTES = 64 * 1024;

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function parseJson<T>(
  request: Request,
  schema: ZodType<T>,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<T> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > maxBytes) throw new HttpError(413, "Request body is too large");

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    throw new HttpError(413, "Request body is too large");
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new HttpError(400, issue?.message || "Invalid request");
  }

  return parsed.data;
}

export const publicApiError = (error: unknown): { status: number; message: string } => {
  if (error instanceof HttpError) return { status: error.status, message: error.message };
  if (error instanceof QuoteValidationError) return { status: 400, message: error.message };
  if (error instanceof z.ZodError) return { status: 400, message: "Invalid request" };
  return { status: 500, message: "Request could not be completed" };
};

export const assertSameOrigin = (request: Request): void => {
  const origin = request.headers.get("origin");
  if (!origin) return;

  let requestOrigin: string;
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const url = new URL(appUrl || request.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("Invalid application origin");
    }
    requestOrigin = url.origin;
  } catch {
    throw new HttpError(400, "Invalid request URL");
  }

  if (origin !== requestOrigin) {
    throw new HttpError(403, "Cross-origin request rejected");
  }
};
