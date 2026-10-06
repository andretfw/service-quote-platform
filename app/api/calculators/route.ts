import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

async function getOrCreateOrganization(userId: string, email: string | undefined) {
  const db = createAdminClient();
  const workspaceName = email ? `${email.split("@")[0]}'s workspace` : "My workspace";
  const { data: organizationId, error } = await db.rpc("get_or_create_default_organization", {
    p_user_id: userId,
    p_workspace_name: workspaceName,
  });
  if (error) throw error;
  return organizationId;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "calculator-create", 20, 3600);

    if (!databaseConfigured() || !publicSupabaseConfigured()) {
      throw new HttpError(503, "Calculator persistence is not configured");
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) throw new HttpError(401, "Sign in before saving a calculator");

    const body = await parseJson(request, createCalculatorRequestSchema);
    const organizationId = await getOrCreateOrganization(user.id, user.email);
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

    if (createError) throw createError;

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
