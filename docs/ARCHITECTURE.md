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
