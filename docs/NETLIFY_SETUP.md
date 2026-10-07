# Netlify launch setup

The repository contains the application and Netlify configuration. Production access to Netlify, Supabase, Stripe and Resend is needed to perform the account steps below. Code tests cannot certify those settings.

## 1. Supabase

1. Create one Supabase project for the entire platform. Businesses share the database with isolated organization-owned rows; do not create a paid project for every customer.
2. Apply every file in `supabase/migrations` in numeric order using the Supabase SQL editor or migration tooling. On an existing installation, apply only unapplied files. Migration 002 starts a 14-day Basic trial for existing workspaces. Migration 004 backfills current-month enquiry usage.
3. Copy the project URL, publishable key and server-only service-role key into Netlify environment variables.
4. In Authentication → URL Configuration, set Site URL to the final HTTPS application address and add the exact `https://YOUR_APP.netlify.app/auth/callback` redirect. Configure localhost separately for development. Do not broadly allow untrusted preview origins.
5. Configure custom SMTP for magic links, such as Resend SMTP. The built-in sender is restricted and unsuitable for customer sign-ins. Verify its sender domain and raise the authentication email rate limit to suit expected signups. Disable email link tracking so authentication links remain intact.
6. For paid customer traffic, configure backups and perform a restore test in a separate project. Supabase Pro includes daily backups; Free requires your own backup process.

## 2. Stripe subscriptions

1. Start in Stripe test mode. After the owner approves subscription pricing, set the approved amounts in `lib/plans.ts` and create matching recurring monthly EUR prices for Basic, Premium and Business. Do not use metered, annual or multi-item prices. The server rejects prices that differ from the published plans.
2. Set `STRIPE_SECRET_KEY` and the three price IDs in `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PREMIUM`, `STRIPE_PRICE_BUSINESS`.
3. Add an account webhook endpoint `https://YOUR_APP.netlify.app/api/billing/webhook`. Subscribe to `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`, and `invoice.payment_action_required`. Set its signing secret as `STRIPE_BILLING_WEBHOOK_SECRET`.
4. Enable the Stripe billing portal: payment-method changes, invoice history, cancellation at period end, and updates between exactly the three configured products/prices. Configure proration/payment collection deliberately. Enable Stripe's option limiting customers to one subscription and redirect existing subscribers to `/billing` as an additional safeguard.
5. Subscriptions are synchronized from canonical Stripe state. Unknown prices, collection pauses, unpaid status and expired periods grant no access. Canceling at period end retains access until the paid period ends. Checkout redirects alone do not grant access. A second Checkout attempt for another plan is blocked while the first reservation is open.
6. Configure platform billing tax and invoice business details according to your operating jurisdiction before taking live subscriptions. The application does not automatically register you for tax or decide your tax obligations.

## 3. Stripe customer deposits

1. Enable Stripe Connect and configure Express onboarding for your platform and supported merchant countries. Set a connected-account webhook endpoint `https://YOUR_APP.netlify.app/api/stripe/webhook`, listening to `checkout.session.completed` and `checkout.session.expired` from connected accounts. Set its signing secret as `STRIPE_CONNECT_WEBHOOK_SECRET`.
2. If migrating earlier platform-owned deposits, retain the old endpoint signing secret in `STRIPE_WEBHOOK_SECRET` until their events are reconciled. Existing pending payments without a new reservation must be reconciled before a replacement session is created.
3. A Business subscriber opens My calculators → Connect Stripe account and supplies its own verification and payout details. The platform never supplies identity documents on the merchant's behalf.
4. In the calculator editor, enable deposits and set the percentage. The business account must have both charges and payouts enabled before checkout succeeds.
5. Deposits are direct charges on the connected business account. Subscription revenue goes to the platform account. Test fees, refunds, dispute responsibility and connected-account reporting in Stripe. No platform application fee is currently added to deposits. Currency options are EUR, USD, GBP, RON, CAD and AUD; Stripe minimums and account availability still apply.
6. Checkout reservations serialize retries. Paid sessions cannot be replaced; expired sessions are reconciled before another checkout is issued. Provider/database failures fail closed. An abandoned reservation with no recorded session may need provider reconciliation rather than assuming no charge occurred.

## 4. Email and scheduled processing

1. For production, verify a sender domain in Resend and set `RESEND_API_KEY` plus `RESEND_FROM`, for example `Service Quote <quotes@YOUR_VERIFIED_DOMAIN>`.
   For a private first test without a domain, use `Service Quote <onboarding@resend.dev>` as `RESEND_FROM` and sign into Resend with the same email as the app workspace owner. The test sender can send only to that Resend account email, not to other businesses or customers.
2. Generate separate random secrets of at least 32 characters for `CRON_SECRET`, `RATE_LIMIT_SECRET`, and `UNSUBSCRIBE_SECRET`. Do not reuse the service-role or Stripe keys. Keep the unsubscribe secret stable while issued links should remain valid.
3. Netlify deploys `netlify/functions/followups.mjs` and runs it every 15 minutes on the published production deploy. Scheduled functions do not run automatically in deploy previews.
4. The worker calls `/api/internal/followups` with a Bearer secret. It processes a bounded batch of owner notifications and consented reminders, aborts slow email requests, and leaves claimed work retryable. New enquiries attempt an immediate owner notification after persistence. Failures remain in the outbox for a scheduled retry; an authorized workspace member can also retry due alerts from the enquiry details page. Provider acceptance is not proof of inbox delivery.
5. Premium/Business reminders must be enabled on the calculator and explicitly selected by the visitor. They stop on booking, lead closure, disabled features, inactive subscription or unsubscribe. Unsubscribe links expire after 90 days; later reminders generate fresh links.
6. Resend quotas cover sign-in emails, owner notifications and reminders if they share one Resend account. Watch both daily and monthly usage. Provider idempotency is an additional duplicate guard; failures after provider acknowledgement can require reconciliation, and email delivery is not an exactly-once guarantee.

## 5. Netlify

1. Import `andretfw/service-quote-platform` from GitHub. Use the repository root as the base directory. `netlify.toml` sets `npm run build`, `.next`, Node 24.21.0 and the scheduled functions directory. Netlify's Next.js adapter handles the application routes.
2. Choose the site address. A free `YOUR_APP.netlify.app` address works; a custom application domain is optional.
3. Add all variables from `.env.example` in Netlify. Set `NEXT_PUBLIC_APP_URL` to the final HTTPS origin. Public Supabase values must be available during build and runtime; server secrets must be available to functions. Changes to public variables require a rebuild.
4. Use separate test credentials/database for previews. Never point untrusted branch previews at live billing or production customer data.
5. Run `npm run config:check` in a trusted environment with the variables present. It checks names and formats without printing secret values. Then deploy and inspect build/function logs.

## 6. Verify before live launch

- Sign in with an address outside the Supabase project team and confirm magic-link delivery.
- Create, edit and archive a calculator; open its public page and test its embed on another origin.
- Submit an enquiry; confirm owner notification and UTC monthly usage. Verify another account cannot access the lead or edit the calculator.
- Subscribe with a Stripe test card. Verify webhook delivery, correct plan/limits, portal upgrades, cancellation and failed renewal handling. Test repeated/concurrent checkout requests.
- On Business, onboard a test connected account, request a booking, confirm/cancel/complete it, and pay a test deposit. Check the business receives the charge, the webhook marks the deposit paid, and a retry cannot open a second paid deposit.
- Enable reminders, opt in, test worker authentication and unsubscribe. Check Resend logs and Netlify scheduled function results.
- Enter the operator's actual privacy/terms/support details and the merchants' service terms, rates and availability policy.
- Switch to matching live prices, live webhook secrets and live Connect configuration only after staging tests pass.

These account-level checks have not been performed merely by committing the code.
