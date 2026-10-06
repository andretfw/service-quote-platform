import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

const contentSecurityPolicy = (allowEmbedding: boolean) =>
  [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    `frame-ancestors ${allowEmbedding ? "*" : "'none'"}`,
  ].join("; ");

export async function proxy(request: NextRequest) {
  const response = await updateSupabaseSession(request);
  const allowEmbedding = request.nextUrl.pathname.startsWith("/embed/");

  response.headers.set("Content-Security-Policy", contentSecurityPolicy(allowEmbedding));
  if (!allowEmbedding) response.headers.set("X-Frame-Options", "DENY");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|embed.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
