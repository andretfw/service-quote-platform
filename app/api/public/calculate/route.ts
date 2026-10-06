import { NextResponse } from "next/server";
import { calculateQuote, toPublicQuoteResult } from "@/lib/pricing-engine";
import { resolveCalculator } from "@/lib/server/calculator-resolver";
import { parseJson, publicApiError } from "@/lib/server/http";
import { calculateRequestSchema } from "@/lib/server/schemas";
import { assertRateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  try {
    await assertRateLimit(request, "calculate", 60, 60);
    const body = await parseJson(request, calculateRequestSchema);
    const resolved = await resolveCalculator(body.template);
    if (!resolved) return NextResponse.json({ error: "Unknown calculator" }, { status: 404 });

    const quote = calculateQuote(resolved.template, body.answers);
    return NextResponse.json(toPublicQuoteResult(quote));
  } catch (error) {
    const { status, message } = publicApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
