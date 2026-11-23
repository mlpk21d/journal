# Trade Journal

Next.js / TypeScript / PostgreSQL / Webull Trading API. Read-only stock-order journal with historical-order synchronization, order-level fees, and wash-sale schema groundwork.

## Install

```bash
npm install
cp .env.example .env.local
# fill DATABASE_URL, WEBULL_APP_KEY, WEBULL_APP_SECRET, JOURNAL_API_TOKEN
set -a; source .env.local; set +a
npm run db:migrate
npm run dev
```

`WEBULL_ENV=production` for your real account; `sandbox` uses test credentials. Never commit keys. Some applications require `WEBULL_ACCESS_TOKEN` if 2FA is enabled.

## Read-only Webull synchronization

Retrieve available accounts:

```bash
curl -H "Authorization: Bearer $JOURNAL_API_TOKEN" http://localhost:3000/api/webull/accounts
```

Synchronize up to 31 days per request (UTC ISO strings with milliseconds):

```bash
curl -X POST http://localhost:3000/api/webull/sync \
  -H "Authorization: Bearer $JOURNAL_API_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"account_id":"REPLACE_ACCOUNT_ID","start_time":"2026-11-01T00:00:00.000Z","end_time":"2026-11-24T00:00:00.000Z"}'
```

Sync jobs paginate historical orders and query order detail. A database advisory lock prevents overlapping syncs of the same account. Each order is upserted by broker account/order ID and each completed-order snapshot is upserted by local order ID. Repeated imports do not duplicate snapshots or fees.

**Accuracy limitation:** Historical order records may lag. Fully filled orders with confirmed quantity, average fill price, and fill timestamp are represented by a *weighted-average order snapshot*, not exchange-level executions. Partial orders and records lacking trustworthy fields are retained as raw orders but deliberately excluded from executions. No fabricated timestamps or synthetic individual fills. Commissions and regulatory fees are saved at **order level** and never multiplied by number of fills. This initial dataset is NOT a validated tax ledger, and does not yet calculate realized P&L.

## API & site index

All API routes require `Authorization: Bearer <JOURNAL_API_TOKEN>`. UI pages must be restricted to trusted networks until session authentication exists.

Pages:
- `/` — overview
- `/trades` — read-only imported completed-order snapshots, with associated order fees

Routes:
- `GET /api/health`
- `GET /api/webull/accounts`
- `GET /api/webull/orders?account_id=...&start_time=...&end_time=...`
- `GET /api/webull/order-detail?account_id=...&client_order_id=...` (or `order_id`)
- `POST /api/webull/sync` — imports records; max 31 days
- `GET /api/webull/imports` — import job history
- `GET /api/orders` — locally saved orders and fees
- `GET /api/trades` — locally saved execution records

## Next steps

- Verify live API order response and fee schema using your own account (no credentials in chat).
- Add broker execution-level data when available. Never infer individual fills from average prices.
- Design authenticated dashboard and background scheduling with bounded jobs.
- Build FIFO/tax-lot reconciliation and wash sale monitoring only after complete historical imports and review of corporate actions and cross-account trades.
- Keep trade-performance P&L distinct from tax-adjusted P&L.

Docs: https://developer.webull.com/apis/docs/reference/order-history/ and https://developer.webull.com/apis/docs/reference/order-detail/

Remove Windows metadata files with `find . -type f -name '*:Zone.Identifier' -delete`.
