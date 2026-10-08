import { assertSameOrigin, HttpError, publicApiError } from "@/lib/server/http";
import { publicSupabaseConfigured } from "@/lib/server/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (publicSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw new HttpError(503, "Unable to sign out. Please try again.");
    }
    return Response.json({ url: "/login" }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const result = publicApiError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
