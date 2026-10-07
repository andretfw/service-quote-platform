# Service Quote Platform

A monthly SaaS for service businesses: publish a price estimator, capture enquiries, manage leads, request bookings and collect deposits into the business's connected Stripe account.

The repository is source-visible for evaluation and authorized collaboration. It is not open source. See [LICENSE](./LICENSE).

## Plans

| Feature                                            | Basic — €19/month | Premium — €49/month | Business — €99/month |
| -------------------------------------------------- | ----------------- | ------------------- | -------------------- |
| Active calculators                                 | 1                 | 5                   | 25                   |
| Enquiries per calendar month, UTC                  | 100               | 1,000               | 10,000               |
| 15 industry templates, question and pricing editor | Included          | Included            | Included             |
| Hosted calculator and website embed                | Included          | Included            | Included             |
| Lead pipeline and owner notifications              | Included          | Included            | Included             |
| Business name and brand color                      | —                 | Included            | Included             |
| CSV lead exports                                   | —                 | Included            | Included             |
| Optional customer email follow-ups and unsubscribe | —                 | Included            | Included             |
| Booking requests and owner confirmation            | —                 | —                   | Included             |
| Customer deposits through Stripe Connect           | —                 | —                   | Included             |

New accounts receive a 14-day Basic trial without a card. Subscription prices are centralized in `lib/plans.ts`; calculator and enquiry limits are also enforced transactionally in the database. Changes to limits must update the database functions as well. Changing prices requires new matching Stripe prices and environment IDs. No setup fee or platform deposit commission is configured; provider fees apply.

Archives retain historical leads while freeing calculator slots. Following a downgrade, the oldest unarchived calculators remain publicly available within the new limit. Inactive subscriptions cannot capture enquiries or use paid customer actions; historical leads remain accessible to their workspace owner.

Painting, cleaning, tiling, landscaping, roofing, HVAC, moving, pressure washing, auto detailing, handyman, flooring, windows, fencing, pest control and photography are included. Template rates are examples: every business must set its own prices, units, service area and tax rate before publishing.

## What is implemented

- Configurable questions, option labels, conditional visibility, numeric rates, option adjustments, multipliers, fixed and conditional charges.
- Immutable calculator revisions and optimistic edit conflicts.
- Validated server-side estimates; private pricing rules never reach the public widget.
- Explicit contact consent; customer reminders require a separate opt-in and include signed unsubscribe links.
- Row Level Security, authenticated workspace authorization, bounded request bodies and database rate limits.
- Monthly subscription Checkout, billing portal, webhook synchronization and enforced feature access.
- Durable checkout reservations, payment amount/currency/reference checks and connected-account verification.
- Transactional booking requests, cancellation and confirmation; leads stop receiving reminders after booking or closure.
- Transactional notification outbox and a Netlify scheduled worker with provider timeouts and retry claims.
- CSV formula injection protection, tested migrations and reproducible CI.

Booking is a request for a preferred time, not real-time calendar availability. Photo uploads, calendar synchronization, CRM integrations and automatic jurisdiction-specific tax calculations are outside the plans above. The configurable estimate tax percentage is a merchant input. Platform subscription tax, business registration, legal documents and payment-provider approvals require the operator's actual details.

## Development

Use Node.js 24.21.0 and npm 11.21.0.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

The bundled `/q/painting` demo works without a database and never stores visitor contact details. Account-backed features need Supabase and all migrations.

```bash
npm run check
npm run build
npm run config:check
```

The test suite executes all migrations against embedded PostgreSQL and verifies account isolation, plan access, lead limits, checkout reservations, archive/downgrade behavior, version conflicts and transactional bookings. External provider operations need separate staging verification. `config:check` reports missing variables without displaying their values; it does not prove that credentials or provider configuration are valid.

## Deployment

Use [docs/NETLIFY_SETUP.md](./docs/NETLIFY_SETUP.md) for the Netlify, Supabase, Stripe and email setup.

All migrations in `supabase/migrations` must be applied in filename order. Do not rerun already-applied migrations on an existing database. Keep secrets in provider environment settings, never in GitHub. Supabase browser clients have organization-scoped read access; mutations run through authenticated server routes or signature-verified webhooks.

After saving a calculator, copy its generated link or embed code from the editor:

```html
<script
  async
  src="https://YOUR_APP.netlify.app/embed.js"
  data-service-quote="PUBLIC_CALCULATOR_ID"
></script>
```

A custom application domain is optional. Resend sender-domain verification is a separate email requirement.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) and [SECURITY.md](./SECURITY.md) for the trust boundaries.
