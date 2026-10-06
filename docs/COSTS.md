# Monthly operating costs

Prices checked against official provider pages on 6 October 2026. USD infrastructure amounts and EUR subscription revenue are separate currencies; taxes, exchange rates, optional add-ons and usage overages are excluded unless stated. These are scenario calculations, not a measured production forecast.

## Supabase

| Configuration                                      | Arithmetic                                        | Monthly estimate |
| -------------------------------------------------- | ------------------------------------------------- | ---------------- |
| Free project                                       | Free plan                                         | $0               |
| Pro, one Micro project                             | $25 plan + $10 compute − $10 compute credit       | $25              |
| Pro, one Small project                             | $25 + $15 − $10                                   | $30              |
| Pro, production + staging, two Micro projects      | $25 + $20 − $10                                   | $35              |
| Pro, Small, 20 GB database, 300 GB uncached egress | $25 + $15 − $10 + (20−8)×$0.125 + (300−250)×$0.09 | $36              |

One project serves all businesses. Customer count alone does not determine the bill; query load, stored data, traffic and authenticated users matter. Anonymous quote visitors are not automatically authenticated monthly active users.

Free includes a 500 MB database, 50,000 authentication MAU, 5 GB uncached egress and 1 GB file storage. Projects can pause after inactivity and have no automatic backups. Pro includes 8 GB database per project, 100,000 MAU, 250 GB uncached egress and daily backups. Paid compute receives one $10 monthly credit per Supabase organization. There is no need for the optional Supabase API custom domain to use a normal application domain.

Source: [Supabase pricing](https://supabase.com/pricing).

## Whole application budget

| Stage                                             | Supabase       | Netlify           | Resend  | Fixed monthly subtotal |
| ------------------------------------------------- | -------------- | ----------------- | ------- | ---------------------- |
| Small pilot within free quotas                    | $0             | $0 Free           | $0 Free | $0                     |
| Early paid launch                                 | $25 Pro/Micro  | $9 Personal       | $0 Free | $34                    |
| Launch with paid email headroom                   | $25 Pro/Micro  | $9 Personal       | $20 Pro | $54                    |
| Production + staging, more hosting/email headroom | $35, two Micro | $20 Pro base tier | $20 Pro | $75                    |

The free combination has hard operational limits. Netlify Free has 300 monthly credits; exhaustion pauses sites. Personal includes 1,000 credits and Pro's starting tier includes 3,000. Your existing Netlify account may use a legacy plan: verify its actual billing dashboard. Resend Free includes 3,000 emails/month and 100/day; Pro starts at $20 with 50,000 emails/month.

There are additional variable Stripe processing, Billing and possibly Connect fees, depending on your country and account setup. Domain registration, tax, refunds, disputes and support are separate. The fixed subtotals are not guaranteed total bills.

A lead may generate one owner email and up to three optional reminders. As an example, 500 leads with all three reminders means 2,000 application emails, plus sign-ins. The Free email plan may fit the monthly count but still exceed its daily allowance. Basic uses no customer reminder emails. Business's maximum 10,000 leads is not a promise that infrastructure Free quotas can support maximum use.

Sources: [Netlify pricing](https://www.netlify.com/pricing/), [Resend pricing](https://resend.com/pricing), [Stripe pricing](https://stripe.com/pricing).

## Free alternatives

The least expensive compatible option is Supabase Free because the application already uses its authentication, PostgreSQL and RLS. Start there for a controlled pilot, then upgrade when paid traffic and backups justify it.

Neon Free is an alternative PostgreSQL service: its current allowance includes 1 GB database storage, 100 compute-unit hours per project and 5 GB public transfer. Moving this application requires replacing Supabase's auth/client layer and adapting RLS identity handling; changing only the database URL is insufficient. Its free quotas still limit production operation.

Self-hosted Supabase avoids the managed-platform subscription but requires a server, backups, security updates and operations. It is not inherently a zero-cost or simpler production solution.

Sources: [Neon plans](https://neon.com/docs/introduction/plans), [Supabase self-hosting](https://supabase.com/docs/guides/self-hosting).

## Subscription revenue

Suggested launch prices are €19 Basic, €49 Premium and €99 Business, all monthly. They are implemented defaults, not validated market demand or guaranteed margins.

For example: 5 Basic + 3 Premium + 2 Business = 5×€19 + 3×€49 + 2×€99 = **€440 monthly gross subscription revenue**. Deduct payment fees, applicable taxes, USD hosting costs converted at the actual exchange rate, support and other operating expenses to determine profit. Do not treat the whole €440 as profit.
