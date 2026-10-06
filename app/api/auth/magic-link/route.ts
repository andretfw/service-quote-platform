import { NextResponse } from "next/server";
import { getAppUrl, publicSupabaseConfigured } from "@/lib/server/env";
import { assertSameOrigin, HttpError, parseJson, publicApiError } from "@/lib/server/http";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { magicLinkRequestSchema } from "@/lib/server/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "auth-magic-link", 5, 15 * 60);

    if (!publicSupabaseConfigured()) {
      throw new HttpError(503, "Authentication is not configured");
    }

    const { email } = await parseJson(request, magicLinkRequestSchema, 8 * 1024);
    const supabase = await createSupabaseServerClient();
    const origin = getAppUrl(new URL(request.url).origin);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });

    if (error) throw new HttpError(400, "Could not send sign-in link");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, message } = publicApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
