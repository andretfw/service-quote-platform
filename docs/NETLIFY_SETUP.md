# Netlify launch setup

The repository contains the application and Netlify configuration. Production access to Netlify, Supabase, Stripe and Resend is needed to perform the account steps below. Code tests cannot certify those settings.

## 1. Supabase

1. Create one Supabase project for the entire platform. Businesses share the database with isolated organization-owned rows; do not create a paid project for every customer.
2. Apply every file in `supabase/migrations` in numeric order using the Supabase SQL editor or migration tooling. On an existing installation, apply only unapplied files. Migration 004 backfills current-month enquiry usage. Migration 007 introduces permanent Free access, one active calculator and seven monthly enquiries. Migration 008 restores Basic to 100 monthly enquiries. Migration 009 sets active calculator limits to 1/5/15/50 and enquiry limits to 7/100/1,000/2,000. Migration 010 adds optional lead automation connections. Migration 011 adds atomic customer reminder claims and completion, including current plan checks and business reply addresses. Migration 012 adds booking duration, internal scheduling/availability and server-only calendar connections and delivery jobs.
3. Copy the project URL, publishable key and server-only service-role key into Netlify environment variables.
4. In Authentication → URL Configuration, set Site URL to the final HTTPS application address and add the exact `https://YOUR_APP.netlify.app/auth/callback` redirect. Configure localhost separately for development. Do not broadly allow untrusted preview origins.
5. Configure custom SMTP for magic links, such as Resend SMTP. The built-in sender is restricted and unsuitable for customer sign-ins. Verify its sender domain and raise the authentication email rate limit to suit expected signups. Disable email link tracking so authentication links remain intact.
6. For paid customer traffic, configure backups and perform a restore test in a separate project. Supabase Pro includes daily backups; Free requires your own backup process.

## 2. Stripe subscriptions

1. Start in Stripe test mode. Create recurring monthly EUR prices matching `lib/plans.ts`: Basic €9, Premium €19 and Business €39. Use licensed, per-unit prices. Do not use metered, annual or multi-item prices. The server rejects prices that differ from the published plans.
2. Set `STRIPE_SECRET_KEY` and the three price IDs in `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PREMIUM`, `STRIPE_PRICE_BUSINESS`.
3. Add an account webhook endpoint `https://YOUR_APP.netlify.app/api/billing/webhook`. Subscribe to `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`, and `invoice.payment_action_required`. Set its signing secret as `STRIPE_BILLING_WEBHOOK_SECRET`.
4. Enable the Stripe billing portal: payment-method changes, invoice history, cancellation at period end, and updates between exactly the three configured products/prices. Configure proration/payment collection deliberately. Enable Stripe's option limiting customers to one subscription and redirect existing subscribers to `/billing` as an additional safeguard.
5. Subscriptions are synchronized from canonical Stripe state. Unknown prices, collection pauses, unpaid status and expired periods grant no paid access; the workspace retains Free access. Canceling at period end retains access until the paid period ends. Checkout redirects alone do not grant access. A second Checkout attempt for another plan is blocked while the first reservation is open.
6. Configure platform billing tax and invoice business details according to your operating jurisdiction before taking live subscriptions. The application does not automatically register you for tax or decide your tax obligations.

## 3. Stripe customer deposits

1. Enable Stripe Connect and configure Standard onboarding for your platform and supported merchant countries. Set a connected-account webhook endpoint `https://YOUR_APP.netlify.app/api/stripe/webhook`, listening to `checkout.session.completed` and `checkout.session.expired` from connected accounts. Set its signing secret as `STRIPE_CONNECT_WEBHOOK_SECRET`.
2. If migrating earlier platform-owned deposits, retain the old endpoint signing secret in `STRIPE_WEBHOOK_SECRET` until their events are reconciled. Existing pending payments without a new reservation must be reconciled before a replacement session is created.
3. A Business subscriber opens My calculators → Connect Stripe account and supplies its own verification and payout details. The platform never supplies identity documents on the merchant's behalf.
4. In the calculator editor, enable deposits and set the percentage. The business account must have both charges and payouts enabled before checkout succeeds.
5. New deposit accounts are Standard accounts, with Stripe collecting direct-charge fees from the business. Existing connected accounts retain their type; review any earlier Express accounts separately before launch because their fee responsibility differs and their type cannot be changed in place. Subscription revenue goes to the platform account. Test fees, refunds, dispute responsibility and connected-account reporting in Stripe. No platform application fee is currently added to deposits. Currency options are EUR, USD, GBP, RON, CAD and AUD; Stripe minimums and account availability still apply.
6. Checkout reservations serialize retries. Paid sessions cannot be replaced; expired sessions are reconciled before another checkout is issued. Provider/database failures fail closed. An abandoned reservation with no recorded session may need provider reconciliation rather than assuming no charge occurred.

## 4. Email and scheduled processing

1. For production, verify a sender domain in Resend and set `RESEND_API_KEY` plus `RESEND_FROM`, for example `Service Quote <quotes@YOUR_VERIFIED_DOMAIN>`.
   For a private first test without a domain, use `Service Quote <onboarding@resend.dev>` as `RESEND_FROM` and sign into Resend with the same email as the app workspace owner. The test sender can send only to that Resend account email, not to other businesses or customers.
2. Generate separate random secrets of at least 32 characters for `CRON_SECRET`, `RATE_LIMIT_SECRET`, and `UNSUBSCRIBE_SECRET`. Do not reuse the service-role or Stripe keys. Keep the unsubscribe secret stable while issued links should remain valid.
3. Netlify deploys `netlify/functions/followups.mjs` and runs it every 15 minutes on the published production deploy. Scheduled functions do not run automatically in deploy previews.
4. The worker calls `/api/internal/followups` with a Bearer secret. Customer reminders identify the calculator and business, include the estimate, and route replies to the workspace owner’s account email. It processes a bounded batch of owner notifications and consented reminders, aborts slow email requests, and leaves claimed work retryable. New enquiries attempt an immediate owner notification after persistence. Failures remain in the outbox for a scheduled retry; an authorized workspace member can also retry due alerts from the enquiry details page. Provider acceptance is not proof of inbox delivery.
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
- Enable reminders, opt in, test worker authentication and unsubscribe. Check the selected email provider and Netlify scheduled function results.
- Enter the operator's actual privacy/terms/support details and the merchants' service terms, rates and availability policy.
- Switch to matching live prices, live webhook secrets and live Connect configuration only after staging tests pass.

These account-level checks have not been performed merely by committing the code.

### Gmail delivery

Set `EMAIL_PROVIDER=gmail`, `GMAIL_USER` to a dedicated Gmail address, and `GMAIL_APP_PASSWORD` to that account’s app password. Store the password as a secret in Netlify’s production Functions environment. Keep `CRON_SECRET` for queued delivery; customer reminders also require `UNSUBSCRIBE_SECRET`. Redeploy after changing variables. The sender is the connected Gmail account, and Resend is bypassed. Test alerts to a different recipient before launch.

Gmail has account sending limits and may temporarily block sending. SMTP does not offer Resend’s idempotency guarantee: a provider acceptance followed by a lost connection or database update failure can result in a duplicate on retry. The outbox lease prevents concurrent workers from sending the same alert. This transport does not change Supabase login email configuration.

## Lead automation connections

Apply migration 010 before opening Connections. The separate `integrations` scheduled function uses `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` (or Netlify's `URL`) and the server-only Supabase variables. It does not depend on the email provider. Netlify scheduled execution runs in production; use a signed request to the internal worker in staging.

Premium and Business workspace owners configure their own Zapier Catch Hook or Make custom webhook and choose their downstream actions. Zapier webhooks require a paid Zapier plan; Make allowances depend on the business's account. No platform-wide Zapier or Make subscription is required. Test with sample data, then a new enquiry from a saved calculator. Check both the delivery history and the destination workflow, including retries, pausing and downgrades, before enabling real customer traffic.

## Booking calendars (Business)

Apply migration 012 before opening Booking calendar. Businesses can use the internal monthly calendar, confirmation, rescheduling, working days/hours and unavailable periods without Google or Microsoft. Set the business time zone explicitly; existing bookings receive a one-hour end time. Working-hour enforcement is opt-in so existing workflows are retained. Block creation and booking confirmation lock the workspace and reject overlapping confirmed bookings. Pending requests do not reserve time.

To enable optional native connections, register **one platform OAuth application per provider**, not one app per business. Set the final HTTPS `NEXT_PUBLIC_APP_URL` before registering callbacks. Use separate OAuth apps or explicitly registered localhost callbacks for local development; do not broadly register untrusted deploy previews.

- Generate a separate 32-byte secret (64 hexadecimal characters) for server-only `CALENDAR_ENCRYPTION_KEY`. Keep it stable: changing it without re-encrypting stored credentials requires reconnecting every calendar. Refresh tokens and PKCE verifiers are encrypted with authenticated, workspace-bound encryption; never expose these variables to browser bundles.
- **Google:** enable Calendar API, configure the OAuth consent screen and a Web application client. Register `https://YOUR_APP.netlify.app/api/calendar/google/callback` exactly. Set `GOOGLE_CALENDAR_CLIENT_ID` and `GOOGLE_CALENDAR_CLIENT_SECRET`. The connection requests the `calendar.events` scope and offline access. Add staging accounts as test users; external apps need Google's production consent/verification requirements completed as applicable. Testing-mode refresh tokens for this scope typically expire after seven days. See [Google OAuth web-server guide](https://developers.google.com/identity/protocols/oauth2/web-server).
- **Outlook:** register a Microsoft Entra Web application supporting organizational directories and personal Microsoft accounts for the `/common` authorization endpoint. Register `https://YOUR_APP.netlify.app/api/calendar/outlook/callback` exactly. Add delegated Microsoft Graph `Calendars.ReadWrite`; the app also requests `offline_access`. Set `MICROSOFT_CALENDAR_CLIENT_ID` and `MICROSOFT_CALENDAR_CLIENT_SECRET` to the secret **value**, and track its expiry. Tenant consent policies may require administrator approval. See [Microsoft authorization-code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow).
- The Business workspace owner selects Connect and grants access to their calendar. Each workspace supports one Google and one Outlook connection; confirmed bookings are sent to both if both are connected. Synchronization targets each account's primary calendar, not a selected secondary calendar. Events contain a generic service-booking title and times; customer contact details are not copied to the provider.
- `netlify/functions/calendars.mjs` runs every five minutes on the published production deploy, calling `/api/internal/calendars` with `CRON_SECRET`. Use a signed manual request in staging; previews do not run scheduled functions automatically. Delivery is bounded and retryable, with five automatic attempts and owner-controlled retry. Pending/failed counts are shown in Booking calendar. Sync is eventual; failures after external acknowledgements are recovered using Google deterministic IDs and Outlook transaction/extended-property identifiers.
- Availability checks fail closed if a connected calendar is unavailable. Dashboard edits create/update/delete external events; edits made directly in Google or Outlook do not modify bookings here. Internal working hours/blocks are not exported as provider events. Disconnecting stops future sync and leaves existing provider events; users can revoke app access in their provider settings. Reconnecting a different account sends future confirmed bookings to the new account and leaves the old account's events for manual cleanup.

Before enabling real traffic, test each provider with a dedicated staging calendar: consent, reconnect/token refresh, a pre-existing busy event (including all-day events and DST), request/confirmation conflicts, rescheduling, cancellation, provider outages/retry and disconnect. Also verify a business with no external calendar. Code tests and disabled connection buttons do not establish live OAuth readiness.
