import { randomBytes } from "node:crypto";
import { normalizeLogo } from "@/lib/server/logo";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspace, requireFeature } from "@/lib/server/workspace";
import { assertCalculatorFeatures } from "@/lib/server/calculator-settings";
import { databaseConfigured, publicSupabaseConfigured } from "@/lib/server/env";
import { assertSameOrigin, HttpError, parseJson, publicApiError } from "@/lib/server/http";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { createCalculatorRequestSchema } from "@/lib/server/schemas";
import type { Json } from "@/lib/supabase/database.types";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "calculator";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "calculator-create", 20, 3600);

    if (!databaseConfigured() || !publicSupabaseConfigured()) {
      throw new HttpError(503, "Calculator persistence is not configured");
    }

    const workspace = await requireWorkspace();
    requireFeature(workspace.plan);
    const body = await parseJson(request, createCalculatorRequestSchema, 256 * 1024);
    assertCalculatorFeatures(body.template, workspace.plan);
    if (body.template.settings?.logoDataUrl) {
      body.template.settings.logoDataUrl = await normalizeLogo(body.template.settings.logoDataUrl);
    }
    const organizationId = workspace.organizationId;
    const db = createAdminClient();
    const publicId = `${slugify(body.template.name)}-${randomBytes(6).toString("hex")}`;

    const { rules, ...schema } = body.template;
    const { data: calculatorId, error: createError } = await db.rpc(
      "create_calculator_with_version",
      {
        p_organization_id: organizationId,
        p_public_id: publicId,
        p_name: body.template.name,
        p_template_slug: body.template.slug,
        p_schema: schema as Json,
        p_pricing_rules: rules as Json,
      },
    );

    if (createError) {
      if (createError.code === "P0001")
        throw new HttpError(402, "Calculator limit reached; upgrade your plan");
      throw createError;
    }

    return NextResponse.json({
      ok: true,
      id: calculatorId,
      publicId,
    });
  } catch (error) {
    const { status, message } = publicApiError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
