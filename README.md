# Service Quote Platform

A source-visible, production-oriented foundation for a configurable **quote → lead → booking → deposit** SaaS for service businesses.

The product is intentionally narrow. It sits in front of an existing CRM or spreadsheet instead of forcing a small business into another all-in-one operating system.

> **License:** this repository is public for product evaluation and engineering review. It is **not open source**. See [LICENSE](./LICENSE).

## Product status

Implemented and reviewable today:

- Schema-driven multi-step quote flows
- 15 bundled service-business templates
- Deterministic rule-based pricing with no `eval` or user-authored executable code
- Conditional questions, required fields, numeric bounds and option validation
- Hosted quote pages plus iframe/JavaScript embeds
- Public form configuration separated from private pricing rules
- Server-side quote recalculation before lead persistence
- Demo templates that never persist visitor contact details
- Authenticated calculator creation with versioned configuration storage
- Supabase persistence with explicit Row Level Security policies
- Database-backed API rate limiting
- High-entropy customer access tokens for post-submission actions
- Transactional booking requests
- Stripe Checkout deposits derived from persisted server-side quote data
- Signature-verified Stripe webhooks with stored amount/currency/reference checks
- Resend follow-ups with concurrency claims and idempotency keys
- Magic-link authentication using the current Next.js 16 Supabase SSR proxy pattern
- Typed Supabase table/RPC contracts
- Core pricing tests and CI workflows

Not represented as complete:

- Real-time merchant calendar availability
- Customer photo/file uploads
- Merchant-specific tax/VAT logic
- Organization-specific transactional email branding/legal copy
- Full calculator revision/editor UX after initial creation
- CRM integrations

## Templates

Painting, Cleaning, Tiling, Landscaping, Roofing, HVAC, Moving, Pressure Washing, Auto Detailing, Handyman, Flooring, Windows, Fencing, Pest Control and Photography.

**The bundled prices are illustrative demo defaults.** A merchant must configure its own pricing, taxes, service areas, terms and availability before using a calculator with customers.

## Trust boundaries

```text
Customer browser / embedded iframe
        │
        │  public questions only — pricing rules are never serialized
        │
        ├── POST /api/public/calculate
        │       ├── rate limit
        │       ├── request validation
        │       └── server-side calculation from canonical rules
        │
        └── POST /api/public/submit
                ├── rate limit
                ├── request validation
                ├── server-side recalculation
                ├── lead + quote snapshot
                └── one high-entropy customer access token
                         │
                         ├── booking request (transactional)
                         └── Stripe deposit session
                                  └── signature-verified webhook
```

Core guarantees:

1. Browser-provided totals are never trusted.
2. Customer-facing pages never receive merchant pricing rules.
3. Deposit amounts come from the persisted quote, not request parameters.
4. Submission IDs alone do not authorize customer actions.
5. Supabase service-role and Stripe secret keys are server-only.
6. Browser Supabase access is read-only through RLS; privileged mutations use narrow server routes.
7. Payment state changes only from verified Stripe webhook events.
8. Public endpoints use database-backed rate limits when the database is configured.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) and [SECURITY.md](./SECURITY.md).

## Local development

Requirements:

- Node.js 24.21+ (24.x Active LTS)
- npm
- A Supabase project for persistence/auth features

```bash
cp .env.example .env.local
npm ci
npm run check
npm run dev
```

Open `http://localhost:3000/q/painting` for a no-database demo flow.

### Environment variables

| Variable                               | Purpose                                                         |
| -------------------------------------- | --------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  | Canonical application origin                                    |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL                                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase publishable key                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | Legacy fallback for older Supabase projects                     |
| `SUPABASE_SERVICE_ROLE_KEY`            | Server-only administrative database key                         |
| `RESEND_API_KEY`                       | Follow-up email provider key                                    |
| `RESEND_FROM`                          | Verified sender identity                                        |
| `STRIPE_SECRET_KEY`                    | Server-side Stripe API key                                      |
| `STRIPE_WEBHOOK_SECRET`                | Stripe webhook signing secret                                   |
| `CRON_SECRET`                          | Bearer secret for the follow-up worker                          |
| `RATE_LIMIT_SECRET`                    | Salt used when hashing client addresses for API rate-limit keys |
| `DEPOSIT_PERCENT`                      | Server-side deposit percentage; defaults to `20`                |

Never expose the service-role key, Stripe secret, webhook secret, cron secret or rate-limit secret with a `NEXT_PUBLIC_` prefix.

## Database

Apply [`supabase/migrations/001_initial.sql`](./supabase/migrations/001_initial.sql) with the Supabase CLI or SQL editor.

The migration creates:

- organizations and memberships
- calculators and append-only calculator versions
- submissions
- bookings
- payments
- API rate-limit state
- narrow RPCs for transactional workspace creation, calculator creation and booking requests

All business-facing tables use RLS. Authenticated browser clients have read access only to rows belonging to their organization. Product mutations run through server routes after authorization.

## Embedding

After a merchant creates a calculator, use its generated public ID:

```html
<script
  async
  src="https://YOUR_DOMAIN/embed.js"
  data-service-quote="YOUR_PUBLIC_CALCULATOR_ID"
></script>
```

Or:

```html
<iframe
  src="https://YOUR_DOMAIN/embed/YOUR_PUBLIC_CALCULATOR_ID"
  title="Instant quote"
  style="width:100%;min-height:640px;border:0"
></iframe>
```

Bundled template IDs such as `painting` remain demos and do not collect lead PII.

## Quality commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run check` runs formatting, linting, type checking and tests together.

## Production checklist

Before taking real merchant traffic:

- Set strong production secrets and rotate them through the hosting provider.
- Configure Supabase backups and test restores.
- Configure Stripe webhooks against the production domain.
- Configure a verified Resend sender/domain.
- Add platform/WAF bot controls in addition to application rate limits.
- Restrict embed origins per merchant if your commercial plan requires it.
- Add private object storage before enabling customer photo uploads.
- Integrate a calendar provider before promising authoritative availability.
- Add organization-specific email templates, consent and legal/unsubscribe requirements.
- Add centralized error monitoring, audit events and webhook delivery observability.
- Implement tax/VAT behavior appropriate to each merchant jurisdiction.

The repository deliberately does not claim controls that are not implemented.

## Repository policy

The repository is source-visible for evaluation, security review and authorized collaboration. Copying, rehosting, rebranding, reselling or using it to operate a competing service is not permitted without written authorization from the copyright holder.
