# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Report it privately to the repository owner with:

- affected route/component
- reproducible steps
- expected vs. actual behavior
- security impact
- suggested mitigation, if known

Do not include real customer PII, live credentials or full access tokens in a report.

## Security model

### Pricing

- Pricing rules are resolved and executed only on the server for public quote flows.
- Customer pages receive questions and display metadata, not pricing rules.
- Quote totals are recalculated from canonical server configuration before persistence.
- No `eval`, dynamic JavaScript expressions or user-authored executable pricing code is supported.

### Customer actions

- A raw submission UUID is not authorization.
- Booking and deposit actions require a high-entropy token returned only at submission creation.
- Only a SHA-256 hash of that token is stored in the database.

### Payments

- Checkout amounts are derived from the persisted quote snapshot.
- Stripe webhook signatures are verified before processing.
- Completed checkout events are checked against stored submission reference, amount and currency.
- Payment transitions are idempotent.

### Authentication and data access

- Supabase service-role credentials are server-only.
- Authenticated browser access is constrained by RLS and is read-only for business data.
- Sensitive writes use narrow server routes after authentication/authorization.
- Next.js 16 `proxy.ts` refreshes Supabase SSR sessions.
- Authenticated pages revalidate the user server-side before returning business data.

### Abuse controls

- Public quote, lead, booking, checkout and login endpoints use database-backed fixed-window rate limits.
- Client addresses are hashed with `RATE_LIMIT_SECRET` before storage.
- Scheduled follow-up execution requires `CRON_SECRET`.
- Follow-up workers claim due rows before sending and use Resend idempotency keys.

## Deployment requirements

Production deployments should additionally use platform/WAF bot controls, restrictive infrastructure IAM, secret rotation, database backups, centralized logs/error reporting and alerts for payment/auth anomalies.
