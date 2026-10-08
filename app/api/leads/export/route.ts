import { leadExport } from "@/lib/server/lead-export";
import { requireWorkspace, requireFeature } from "@/lib/server/workspace";
import { publicApiError } from "@/lib/server/http";
import { assertRateLimit } from "@/lib/server/rate-limit";

export async function GET(request: Request) {
  try {
    await assertRateLimit(request, "lead-export", 5, 600);
    const workspace = await requireWorkspace();
    requireFeature(workspace.plan, "exports");
    const supabase = await import("@/lib/supabase/server").then((m) =>
      m.createSupabaseServerClient(),
    );
    const { data: calculators, error: calculatorError } = await workspace.db
      .from("calculators")
      .select("id")
      .eq("organization_id", workspace.organizationId);
    if (calculatorError) throw calculatorError;
    const stream = await leadExport(
      supabase,
      calculators.map((calculator) => calculator.id),
      request.signal,
    );
    return new Response(stream, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="leads.csv"',
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const result = publicApiError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
