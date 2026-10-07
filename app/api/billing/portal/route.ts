import { NextResponse } from "next/server";
import { assertSameOrigin, HttpError, publicApiError } from "@/lib/server/http";
import { requireWorkspace } from "@/lib/server/workspace";
import { billingStripe } from "@/lib/server/billing";
import { getAppUrl } from "@/lib/server/env";
import { assertRateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "billing-portal", 10, 600);
    const workspace = await requireWorkspace(true);
    const { data, error } = await workspace.db
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", workspace.organizationId)
      .single();
    if (error) throw error;
    if (!data.stripe_customer_id) throw new HttpError(409, "Choose a subscription first");
    const portal = await billingStripe().billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${getAppUrl(new URL(request.url).origin)}/billing`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    const result = publicApiError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
