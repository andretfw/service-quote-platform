import { csvRow } from "@/lib/csv";
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
    const { data, error } = await supabase
      .from("submissions")
      .select("id,lead_name,lead_email,lead_phone,status,created_at")
      .in(
        "calculator_id",
        calculators.map((calculator) => calculator.id),
      )
      .order("created_at", { ascending: false })
      .limit(10000);
    if (error) throw error;
    const rows = [
      csvRow(["ID", "Name", "Email", "Phone", "Status", "Created"]),
      ...data.map((lead) =>
        csvRow([
          lead.id,
          lead.lead_name,
          lead.lead_email,
          lead.lead_phone,
          lead.status,
          lead.created_at,
        ]),
      ),
    ];
    return new Response(rows.join("\r\n"), {
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
