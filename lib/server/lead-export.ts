import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { csvRow } from "@/lib/csv";

export async function leadExport(
  db: SupabaseClient<Database>,
  calculatorIds: string[],
  signal: AbortSignal,
) {
  const snapshot = new Date().toISOString();
  type Cursor = { created_at: string; id: string };
  const load = async (cursor?: Cursor) => {
    let query = db
      .from("submissions")
      .select("id,lead_name,lead_email,lead_phone,status,created_at")
      .in("calculator_id", calculatorIds)
      .lte("created_at", snapshot)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(500);
    if (cursor)
      query = query.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
      );
    const { data, error } = await query.abortSignal(signal);
    if (error) throw error;
    return data;
  };
  let batch = calculatorIds.length ? await load() : [];
  let header = true;
  let cancelled = false;
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (signal.aborted || cancelled) throw new Error("Export cancelled");
        const rows = header ? [csvRow(["ID", "Name", "Email", "Phone", "Status", "Created"])] : [];
        header = false;
        rows.push(
          ...batch.map((lead) =>
            csvRow([
              lead.id,
              lead.lead_name,
              lead.lead_email,
              lead.lead_phone,
              lead.status,
              lead.created_at,
            ]),
          ),
        );
        controller.enqueue(encoder.encode(rows.join("\r\n") + "\r\n"));
        if (!batch.length) {
          controller.close();
          return;
        }
        const cursor = batch[batch.length - 1];
        batch = await load(cursor);
        if (!cancelled && !batch.length) controller.close();
      } catch (error) {
        if (!cancelled) controller.error(error);
      }
    },
    cancel() {
      cancelled = true;
    },
  });
}
