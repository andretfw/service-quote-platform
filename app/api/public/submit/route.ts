import { locales } from "@/lib/i18n";
import { attemptLeadNotification } from "@/lib/server/notifications";
import { NextResponse } from "next/server";
import { calculateQuote, toPublicQuoteResult } from "@/lib/pricing-engine";
import { resolveCalculator } from "@/lib/server/calculator-resolver";
import { databaseConfigured } from "@/lib/server/env";
import { HttpError, parseJson, publicApiError } from "@/lib/server/http";
import { submitRequestSchema } from "@/lib/server/schemas";
import { createAccessToken, hashAccessToken } from "@/lib/server/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRateLimit } from "@/lib/server/rate-limit";
import type { Json } from "@/lib/supabase/database.types";

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
    const { data: submissionId, error } = await db.rpc("capture_submission", {
      p_calculator_id: resolved.calculatorId,
      p_template_slug: resolved.template.slug,
      p_answers: body.answers as Json,
      p_quote: {
        ...quote,
        locale: (resolved.template.settings?.languages ?? [...locales]).includes(
          body.locale ?? "en",
        )
          ? (body.locale ?? "en")
          : (resolved.template.settings?.locale ?? "en"),
      } as unknown as Json,
      p_name: body.lead.name,
      p_email: body.lead.email || null,
      p_phone: body.lead.phone || null,
      p_token_hash: hashAccessToken(accessToken),
      p_follow_up_consent: body.followUpConsent && Boolean(resolved.template.settings?.followUps),
    });
    if (error) {
      if (error.code === "P0001")
        throw new HttpError(402, "This business cannot accept more enquiries right now");
      throw error;
    }

    await attemptLeadNotification(submissionId);
    return NextResponse.json({
      ok: true,
      submissionId,
      accessToken,
      estimate: toPublicQuoteResult(quote),
    });
  } catch (error) {
    const { status, message } = publicApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
