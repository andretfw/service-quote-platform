import { normalizeLogo } from "@/lib/server/logo";
import { NextResponse } from "next/server";
import { assertSameOrigin, HttpError, parseJson, publicApiError } from "@/lib/server/http";
import { reviseCalculatorRequestSchema } from "@/lib/server/schemas";
import { requireCalculator } from "@/lib/server/workspace";
import { assertCalculatorFeatures } from "@/lib/server/calculator-settings";
import { assertRateLimit } from "@/lib/server/rate-limit";
import type { Json } from "@/lib/supabase/database.types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "calculator-edit", 60, 600);
    const { id } = await params;
    const workspace = await requireCalculator(id);
    const body = await parseJson(request, reviseCalculatorRequestSchema, 256 * 1024);
    assertCalculatorFeatures(body.template, workspace.plan);
    if (body.template.settings?.logoDataUrl) {
      body.template.settings.logoDataUrl = await normalizeLogo(body.template.settings.logoDataUrl);
    }
    const { rules, ...schema } = body.template;
    const { data: version, error } = await workspace.db.rpc("revise_calculator", {
      p_organization_id: workspace.organizationId,
      p_calculator_id: id,
      p_expected_version: body.expectedVersion,
      p_name: schema.name,
      p_schema: schema as Json,
      p_pricing_rules: rules as Json,
    });
    if (error) {
      if (error.code === "40001")
        throw new HttpError(409, "Another edit was saved. Reload before saving again.");
      throw error;
    }
    return NextResponse.json({ id, publicId: workspace.calculator.public_id, version });
  } catch (error) {
    const result = publicApiError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
