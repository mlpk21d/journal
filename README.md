# Trade Journal

Next.js / TypeScript / PostgreSQL / Webull Trading API. Read-only stock-order journal with historical-order synchronization, order-level fees, and wash-sale schema groundwork.

## Install

```bash
npm install
cp .env.example .env.local
# fill DATABASE_URL, WEBULL_APP_KEY, WEBULL_APP_SECRET, JOURNAL_API_TOKEN
npm run db:migrate  # automatically loads .env.local when present
npm run dev
```

`WEBULL_ENV=production` for your real account; `sandbox` uses test credentials. Never commit keys. Some applications require `WEBULL_ACCESS_TOKEN` if 2FA is enabled.

## Webull production 2FA activation

With `WEBULL_ENV=production`, `WEBULL_APP_KEY`, and `WEBULL_APP_SECRET` set in `.env.local`:

```bash
npm run webull:token
```

This sends a signed token-creation request and writes `WEBULL_ACCESS_TOKEN` to the local, gitignored `.env.local` without printing it. Within five minutes, open the Webull mobile app and navigate to **Menu → Messages → OpenAPI Notifications → Check Now**, then confirm using the SMS code. Webull requires token status `NORMAL` before account calls succeed. Restart Next.js after activation and call `GET /api/webull/accounts` again.

Webull's documentation: https://developer.webull.com/apis/docs/authentication/token/. This command must not be run as part of deployment or CI. If token creation fails, inspect the sanitized HTTP status and error code; never share credentials.

## Troubleshooting production 401 UNAUTHORIZED

Webull documents HTTP 401 UNAUTHORIZED as commonly caused by a credential/environment mismatch. Confirm the exact newly issued **production** App Key/Secret pair is saved in `.env.local`, `WEBULL_ENV=production`, and `WEBULL_USE_ACCESS_TOKEN=false` when API 2FA is disabled. A leftover `WEBULL_ACCESS_TOKEN` is ignored unless `WEBULL_USE_ACCESS_TOKEN=true`. Fully stop and restart the Next.js server after changing credentials. Note that environment variables already exported by your shell may override `.env.local`.

If the 401 persists, verify the production application/key is active and has Trading API permission in Webull's developer console. Never share App Keys, App Secrets or Tokens in bug reports. The app's journal bearer token is unrelated to the upstream Webull 401.

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

Sync jobs paginate grouped historical orders, flatten the child orders, and query order detail. A database advisory lock prevents overlapping syncs of the same account. Each order is upserted by broker account/order ID and each completed-order snapshot is upserted by local order ID. Repeated imports do not duplicate snapshots or fees. A stale completed-order snapshot is removed if subsequent order detail no longer qualifies. All Webull requests (account discovery, history pages, and order details) share a serialized process-wide limiter paced at **one request every 2.5 seconds** (target ~24/minute to accommodate Webull's separate 2 requests/2 seconds limits on history and detail and 10 requests/30 seconds on account discovery), including when importing multiple accounts. HTTP 429 responses honor Retry-After when present and retry up to 2 times with a shared 30–120 second cooldown and a 5-minute circuit breaker if those attempts also fail. A persistent 429 stops the remaining all-account import queue rather than continuing to call Webull. Because this limiter is process-local, run only **one** Next.js application instance for the local importer; multiple independent server processes or other consumers of the same Webull keys are not coordinated.

**Accuracy limitation:** Historical order records may lag. Fully filled orders with confirmed quantity, average fill price, and fill timestamp are represented by a *weighted-average order snapshot*, not exchange-level executions. Partial orders and records lacking trustworthy fields are retained as raw orders but deliberately excluded from executions. No fabricated timestamps or synthetic individual fills. Commissions and regulatory fees are saved at **order level** and never multiplied by number of fills. This initial dataset is NOT a validated tax ledger, and does not yet calculate realized P&L.

## Local browser import (recommended)

Start Next.js with `npm run dev` and open **http://localhost:3000/import**. The server discovers available brokerage accounts from Webull automatically; you can select one account or **All accounts**. Choose a date range (first test: 1–3 trading days) and click **Import Webull trades**. Each account is synced sequentially, with its own success/failure summary. The browser does not require the journal bearer token or expose Webull credentials.

This browser workflow is deliberately restricted to Next.js development requests addressed to localhost/127.0.0.1. It is **not** a production authentication system. For deployment, implement signed-in sessions and authorization before enabling it. If running the app on a remote Ubuntu machine, access it through an SSH local-port tunnel rather than exposing the local-only import feature publicly.

## Verify the first real import

1. Restart Next.js after pulling updates. Make sure `WEBULL_ENV=production` and `WEBULL_USE_ACCESS_TOKEN=false`.
2. Visit `/import`; account IDs are detected automatically.
3. Choose a **small** range (1–3 trading days), select an account or All Accounts, then click **Import Webull trades**.
4. Confirm `GET /api/webull/imports`, `GET /api/orders`, and `GET /api/trades` report the expected quantities and fees. The trade page is also available at `/trades`.
5. Run the **same** sync again and verify record counts do not increase. Compare against Webull's own account statement before relying on any P&L calculation.
6. Run `npm test` to execute parser and signature regression tests (Node.js 24).

Webull may omit recently executed orders from historical data for a period, so repeat a small overlapping date range after those orders settle. If the API reports an error, consult the Next.js server log and `import_runs`; do not share API credentials or raw account data.

**Security:** API routes require a private bearer token, but the HTML `/trades` page does **not yet have session login protection**. Keep the application restricted to localhost/trusted networks until authentication is implemented; do not expose it to the public Internet.

## API & site index

All API routes require `Authorization: Bearer <JOURNAL_API_TOKEN>`. UI pages must be restricted to trusted networks until session authentication exists.

Pages:
- `/` — overview
- `/import` — local-only import interface, automatic account discovery and multi-account sync
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

## Planned brokerage connection settings

The current production Webull integration can run with API 2FA disabled; do not require `WEBULL_ACCESS_TOKEN` for that configuration. This is a temporary operational choice, **not** a reason to expose credentials in client code.

Future `/settings/brokerages` UI requirements:
- Require authenticated user sessions and authorization before displaying or modifying brokerage connections. Protect credential-changing routes against CSRF and abuse.
- Allow adding, replacing, testing, and revoking Webull App Key / App Secret without editing `.env.local` or using a terminal.
- Encrypt brokerage credentials at rest using authenticated encryption and a separately managed server-side encryption key; never put the encryption key in the same database, send secrets back to the browser, or log secrets.
- Show masked identifiers and connection status only. Use server-side requests for all Webull operations.
- Allow future API 2FA token activation and renewal with explicit status reporting, without requiring it now.
- Provide an authenticated manual Sync Trades action and accurate import feedback.
- Migrate legacy environment-based credentials safely and support credential rotation; do not delete existing credentials until replacements are verified.

**Implementation order:** application authentication/security first, then encrypted brokerage credential storage, then settings UI and optional token activation.
