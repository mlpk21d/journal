# Trade Journal

Next.js 16 / TypeScript / PostgreSQL / Webull OpenAPI read-only foundation. Stock executions and fees are modeled separately from wash sale tax adjustments.

## Local setup

1. Install Node.js 24 and PostgreSQL. Create an empty database and a least-privilege role.
2. `npm install`
3. `cp .env.example .env.local` and configure `DATABASE_URL`, `WEBULL_APP_KEY`, `WEBULL_APP_SECRET`, `JOURNAL_API_TOKEN`. Use `WEBULL_ENV=sandbox` unless approved for production.
4. Load environment variables before migrations, e.g. `set -a; source .env.local; set +a; npm run db:migrate`.
5. `npm run dev` and browse http://localhost:3000.

API routes require `Authorization: Bearer <JOURNAL_API_TOKEN>`:
- `GET /api/health`
- `GET /api/webull/accounts`
- `GET /api/webull/orders?account_id=...&start_time=2026-11-01T00:00:00.000Z&end_time=2026-11-24T00:00:00.000Z`
- `GET /api/trades?limit=50`

## Status / boundaries

- This foundation does **not** place trades, import orders into the database, or calculate tax-adjusted P&L yet. The Webull order route is a live read-only inspection endpoint.
- Webull historical order records may be delayed; use order details for reconciliation.
- Fees must only be assigned to executions after verified mapping. Aggregate order-level commissions must never be duplicated across multiple fills.
- For wash sales, the schema is preliminary. A calculation engine must account for both directions of the 30-day window, corporate actions, tax lots, accounts/IRAs and options.
- API tokens protect read routes; for public deployment, add session authentication and CSRF/rate limiting before enabling an interactive import UI.
- Signature docs: https://developer.webull.com/apis/docs/authentication/signature/
- API docs: https://developer.webull.com/apis/docs/
- Remove Windows Zone.Identifier sidecars with `find . -type f -name '*:Zone.Identifier' -delete`.

## Site index

Current pages: `/` (foundation landing page). Current read-only API routes are listed above. When adding routes, update this index.
