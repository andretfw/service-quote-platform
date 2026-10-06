const groups = {
  Accounts: [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RATE_LIMIT_SECRET",
  ],
  Subscriptions: [
    "STRIPE_SECRET_KEY",
    "STRIPE_PRICE_BASIC",
    "STRIPE_PRICE_PREMIUM",
    "STRIPE_PRICE_BUSINESS",
    "STRIPE_BILLING_WEBHOOK_SECRET",
  ],
  Deposits: ["STRIPE_CONNECT_WEBHOOK_SECRET"],
  Email: ["RESEND_API_KEY", "RESEND_FROM", "CRON_SECRET", "UNSUBSCRIBE_SECRET"],
};
const errors = [];
for (const [group, names] of Object.entries(groups)) {
  const missing = names.filter((name) => !process.env[name]?.trim());
  console.log(
    `${group}: ${missing.length ? `missing ${missing.join(", ")}` : "variables present"}`,
  );
  errors.push(...missing);
}
if (
  !(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim()
)
  errors.push("Supabase browser key");
for (const name of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
  try {
    const url = new URL(process.env[name]);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
  } catch {
    errors.push(`${name} must be a valid HTTPS URL`);
  }
}
for (const name of ["CRON_SECRET", "RATE_LIMIT_SECRET", "UNSUBSCRIBE_SECRET"]) {
  if ((process.env[name]?.trim().length ?? 0) < 32)
    errors.push(`${name} must have at least 32 random characters`);
}
console.log(
  "This checks variable presence and basic formats. Verify migrations, SMTP, prices, webhook delivery, Connect onboarding and email delivery with the provider accounts before launch.",
);
if (errors.length) {
  console.error(`Configuration incomplete: ${[...new Set(errors)].join("; ")}`);
  process.exitCode = 1;
}
