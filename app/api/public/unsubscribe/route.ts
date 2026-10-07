import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { publicApiError } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    await assertRateLimit(request, "unsubscribe", 30, 600);
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const secret = process.env.UNSUBSCRIBE_SECRET?.trim();
    if (!secret)
      return Response.json({ error: "Email preferences are not configured" }, { status: 503 });
    const id = verifyUnsubscribeToken(token, secret);
    if (!id)
      return Response.json(
        { error: "This unsubscribe link is invalid or expired" },
        { status: 400 },
      );
    const { error } = await createAdminClient()
      .from("submissions")
      .update({ follow_up_consent: false, next_follow_up_at: null })
      .eq("id", id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    const result = publicApiError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
