import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicSupabaseConfigured } from "@/lib/server/env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!publicSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=not-configured", url.origin));
  }

  if (!code) return NextResponse.redirect(new URL("/login?error=missing-code", url.origin));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return NextResponse.redirect(new URL("/login?error=auth", url.origin));
  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
