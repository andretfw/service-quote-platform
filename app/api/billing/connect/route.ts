import { NextResponse } from "next/server";
import { assertSameOrigin, publicApiError } from "@/lib/server/http";
import { requireWorkspace, requireFeature } from "@/lib/server/workspace";
import { billingStripe } from "@/lib/server/billing";
import { getAppUrl } from "@/lib/server/env";
import { assertRateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await assertRateLimit(request, "connect-onboarding", 10, 600);
    const workspace = await requireWorkspace(true);
    requireFeature(workspace.plan, "deposits");
    const stripe = billingStripe();
    let accountId = workspace.organization.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create(
        {
          type: "express",
          email: workspace.user.email,
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          metadata: { organization_id: workspace.organizationId },
        },
        { idempotencyKey: `merchant:${workspace.organizationId}` },
      );
      accountId = account.id;
      const { error } = await workspace.db
        .from("organizations")
        .update({ stripe_account_id: accountId })
        .eq("id", workspace.organizationId);
      if (error) throw error;
    }
    const origin = getAppUrl(new URL(request.url).origin);
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${origin}/workspace`,
      return_url: `${origin}/workspace`,
    });
    return NextResponse.json({ url: link.url });
  } catch (error) {
    const result = publicApiError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
