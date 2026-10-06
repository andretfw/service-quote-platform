import { NextResponse } from "next/server";
import { calculateQuote, toPublicQuoteResult } from "@/lib/pricing-engine";
import { resolveCalculator } from "@/lib/server/calculator-resolver";
import { databaseConfigured } from "@/lib/server/env";
import { parseJson, publicApiError } from "@/lib/server/http";
import { submitRequestSchema } from "@/lib/server/schemas";
import { createAccessToken, hashAccessToken } from "@/lib/server/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRateLimit } from "@/lib/server/rate-limit";
import type { Json } from "@/lib/supabase/database.types";

const firstFollowUpAt = (): string => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

export async function POST(request: Request) {
  try {
    await assertRateLimit(request, "submit", 10, 600);
    const body = await parseJson(request, submitRequestSchema);
    const resolved = await resolveCalculator(body.template);
    if (!resolved) return NextResponse.json({ error: "Unknown calculator" }, { status: 404 });

    const quote = calculateQuote(resolved.template, body.answers);

    // Bundled industry templates are product demos. Never persist PII for an
    // unowned demo calculator, even when the database is configured.
    if (resolved.calculatorId === null || !databaseConfigured()) {
      return NextResponse.json({ ok: true, demo: true, estimate: toPublicQuoteResult(quote) });
    }

    const accessToken = createAccessToken();
    const db = createAdminClient();
    const { data, error } = await db
      .from("submissions")
      .insert({
        calculator_id: resolved.calculatorId,
        template_slug: resolved.template.slug,
        answers: body.answers as Json,
        quote: quote as unknown as Json,
        lead_name: body.lead.name,
        lead_email: body.lead.email || null,
        lead_phone: body.lead.phone || null,
        status: "new",
        access_token_hash: hashAccessToken(accessToken),
        next_follow_up_at: firstFollowUpAt(),
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      submissionId: data.id,
      accessToken,
      estimate: toPublicQuoteResult(quote),
    });
  } catch (error) {
    const { status, message } = publicApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
