import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl, publicSupabaseConfigured } from "@/lib/server/env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = getAppUrl(url.origin);

  if (!publicSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=not-configured", origin));
  }

  if (!code) return NextResponse.redirect(new URL("/login?error=missing-code", origin));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return NextResponse.redirect(new URL("/login?error=auth", origin));
  return NextResponse.redirect(new URL("/dashboard", origin));
}
