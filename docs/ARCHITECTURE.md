# Architecture

## Principles

The codebase is organized around four boundaries:

1. **Public presentation** — questions and merchant-facing copy that can safely reach an untrusted browser.
2. **Pricing domain** — deterministic pricing rules and answer validation.
3. **Server trust boundary** — request validation, authorization, rate limiting, persistence and third-party secrets.
4. **Persistence boundary** — Supabase tables, RLS policies and transactional RPCs.

Keeping these boundaries explicit prevents a UI refactor from accidentally exposing pricing rules or privileged credentials.

## Quote resolution

`resolveCalculator(publicId)` resolves either:

- a bundled demo template, or
- a persisted merchant calculator and its active immutable version.

`toPublicQuoteConfig()` intentionally strips all pricing rules before a configuration crosses the server/client boundary.

Bundled templates are demos. Even with a configured database they do not persist lead contact details because they have no owning organization.

## Pricing engine

The pricing engine accepts typed rules only:

- base amount
- numeric per-unit adjustment
- single-choice adjustment
- multi-select adjustment
- conditional adjustment
- multiplier

The engine rejects invalid answers and ignores stale answers belonging to questions that are no longer visible. This prevents hidden form state from continuing to alter a quote.

## Persistence

Business tables are RLS-enabled. Browser sessions can read only organization-owned rows. Product writes use server routes with an administrative client after authorization.

Multi-write operations that require atomicity are implemented as database functions:

- calculator + initial version creation
- booking + submission-state transition

## Payments

The customer never supplies a payment amount. The server reads the persisted quote, derives the deposit, and creates Stripe Checkout. Webhooks are signature verified and then matched to the stored checkout session, submission reference, amount and currency.

## Follow-ups

The scheduler selects due rows, then performs a conditional claim before sending. This prevents concurrent workers from processing the same row at the same time. Resend idempotency keys provide an additional duplicate-send guard for retries.

## Embeds

`public/embed.js` creates an iframe hosted on the application origin. This keeps the merchant website isolated from the application runtime and prevents host-page JavaScript from directly accessing quote state because of the browser same-origin policy.

The `/embed/*` CSP permits framing. Other application pages set `frame-ancestors 'none'` and `X-Frame-Options: DENY`.

## Subscriptions and limits

The authenticated workspace is resolved from the verified Supabase session and membership. Billing actions require the owner role. Feature access is computed from the persisted Stripe subscription and paid-period expiry. New accounts and inactive paid subscriptions use the permanent Free plan. Free does not need a Stripe price or subscription; monthly usage carries across plan changes.

Canonical Stripe subscriptions are matched against the workspace customer and configured price IDs. The database locks workspace state during synchronization and rejects an older observation. Public calculator lookup applies archive and downgrade limits; submission capture locks the workspace and increments the monthly UTC counter in the same transaction as the lead insert. Failed quota checks roll back the increment.

Subscription checkout reservations serialize conflicting plan checkouts and supply stable provider idempotency keys. Deposit reservations serialize customer retries separately. A deposit session can be replaced only after its canonical Stripe state is expired and the database records are reconciled. Webhook payment checks include the connected account as well as amount, currency and submission reference.

## Notification delivery

A database trigger queues owner notifications in a private outbox as part of lead persistence. A new enquiry attempts immediate delivery after persistence. A Netlify scheduled function invokes the authenticated worker every 15 minutes to retry pending notifications and process consented customer reminders. Claims are conditional; provider calls have explicit timeouts and stable idempotency keys. Unprocessed claims become retryable. This is retry-oriented delivery, not an exactly-once guarantee.

Customer reminder consent is stored separately from permission to answer an enquiry. Signed unsubscribe tokens expire, and unsubscribe atomically clears consent and future scheduling. A message already handed to the provider may still arrive after unsubscribe.

## Lead automation

Premium and Business owners can configure one Zapier Catch Hook or Make custom webhook per workspace. The endpoint is private and restricted to supported HTTPS provider hosts and paths; redirects, credentials, ports and query strings are rejected. Customer browsers never receive the endpoint.

A submission trigger queues the delivery in the same transaction as the enquiry. A separate Netlify worker runs every five minutes, claims one due event at a time, rechecks the current plan and connection revision, and posts only contact details, answers, calculator display metadata and the public estimate range. Access tokens, private pricing rules and quote breakdowns are excluded. HTTP responses are reduced to their status code rather than stored.

Claims use unique lease tokens and expire after five minutes. Failed requests retry up to five attempts; receivers should deduplicate by event ID. Pausing or replacing a connection cancels queued deliveries. A request already handed to a provider can still complete. There is no historical backfill or native two-way CRM synchronization.
