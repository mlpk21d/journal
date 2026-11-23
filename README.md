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

Apply database migration **003** with `npm run db:migrate`, start Next.js with `npm run dev`, and open **http://localhost:3000/import**. The page reads saved Webull accounts from PostgreSQL immediately, then triggers a non-blocking refresh when the cache is due; you can select one account or **All accounts**. Choose a date range (first test: 1–3 trading days) and click **Import Webull trades**. Each account is synced sequentially, with its own success/failure summary. The browser does not require the journal bearer token or expose Webull credentials. The account cache refresh is claimed atomically in PostgreSQL and runs at most once per 30 minutes while the import page is being used (failed requests retry after 5 minutes). There is no persistent background daemon: refresh is initiated silently when visiting the page, but does not delay rendering cached data. Import account authorization uses the cached list rather than an extra Webull request.

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

Pages (accessible through the global top-right hamburger menu and right-side drawer):
- `/` — overview
- `/import` — local-only import interface, automatic account discovery and multi-account sync
- `/manual` — local-only generic manual stock BUY/SELL and historical opening entries, with create/edit/delete
- `/trades` — read-only imported and manually entered transactions in five columns: Symbol, Side (green BUY/red SELL), Quantity, Avg Price (2 decimals), Fees (2 decimals); case-insensitive exact ticker filter (`/trades?symbol=NVDA`) applied to all stored history before limiting to the latest 100 matches
- `/performance` — localhost-development-only provisional FIFO realized P&L, per-account breakdown/filter, short covers and open journal lots

Routes:
- `GET /api/health`
- `GET /api/webull/accounts`
- `GET /api/webull/orders?account_id=...&start_time=...&end_time=...`
- `GET /api/webull/order-detail?account_id=...&client_order_id=...` (or `order_id`)
- `POST /api/webull/sync` — imports records; max 31 days
- `GET /api/webull/imports` — import job history
- `GET /api/orders` — locally saved orders and fees
- `GET /api/trades` — locally saved execution records

## Account cache and navigation

Migration `003_account_cache.sql` adds account display names, user aliases, masked account references, refresh timestamps, and one row to coordinate Webull cache refreshes. Existing imported accounts are retained. On initial page load, saved account IDs appear immediately; the server-side refresh asynchronously updates any richer metadata returned by Webull. The account format is centrally generated from account type and immutable Webull ID; any previously saved custom aliases remain in PostgreSQL but no longer override the standardized display format. Account labels also appear on `/performance`. The right-side slide-out menu links to the application pages, including manual trades. No new public pages or unprotected credential-editing endpoints were added. The cache is protected by existing local-development-only server actions.

## Generic manual trade entries

Apply migration **005** with `npm run db:migrate`, then visit **http://localhost:3000/manual**. This migration **preserves** existing `manual_opening_lots` records by renaming the table to `manual_trades`, preserving opening-share quantities, prices, dates and notes. The existing records are marked `OPENING`, side `BUY`, fees `0`.

Manual trade validation is implemented in reusable `src/features/manual-trades/validation.ts` and gives field-specific error messages (e.g. `Shares:` or `Entry type:`) instead of a single generic rejection. Symbols entered as `$AMZN` are normalized to `AMZN`, and UTC times with optional seconds are supported. Run `npm test` for the manual-trade regression tests. The form retains entered values while the save request is pending and on validation/database failure. Save feedback appears immediately in the form, including a specific migration-required error when the database table or columns are missing. When saving fails, inspect the terminal log tagged `[Manual trades] Save failed` (PostgreSQL error code is shown without credentials). If the page reports that migration 005 is required, run `npm run db:migrate` against the **same DATABASE_URL used by Next.js**, then restart the application. The `schema_migrations` table records applied migrations.

The generic entry form supports **Trade** BUY/SELL transactions and **Opening shares** for older historical BUY acquisitions. Each entry includes brokerage account, symbol, trade date/time in UTC, quantity, unit price, total fees and notes. All manually entered records are marked unverified and clearly separated from Webull executions. You can **Edit**, **Cancel edit**, or **Delete** any manually entered row; changes immediately recalculate provisional FIFO results. A row's side can be changed for a regular Trade; Opening shares is restricted to BUY. Never enter a Webull-imported transaction again, as that would double-count it.

The standalone, reusable `src/features/manual-trades/editor.tsx` exports `ManualTradeEditor`, `ManualTradeRow` and `AccountOption`. Mount it on another trusted page with `accounts` and `trades` props and optionally `title`, `description`, or `showHistory`. Server actions live in `src/features/manual-trades/actions.ts` and enforce local-development-only access. To use it on a deployed page, implement authenticated sessions/authorization first. Entries persist in `manual_trades`, are shown on `/trades`, and participate in FIFO calculations on `/performance`.

**Tax warning:** Free promotional shares and gifts do not necessarily have $0 tax basis. Basis can depend on the award treatment, compensation inclusion, or donor carryover basis. Verify source records. User-entered amounts do not constitute validated tax lots, and FIFO performance is not tax reporting.

## Provisional realized performance

Open **http://localhost:3000/performance** after importing a sufficiently complete transaction history. The page recalculates the ledger from earliest available imported completed-order snapshots, matches long exits and short covers FIFO **within each brokerage account and symbol**, combining Webull order snapshots with separately sourced manual trades (including migrated historical opening lots), and shows matched gross P&L, net P&L where actual fees are present, and open journal positions. Original cost basis excludes fees; matched net results subtract allocated entry and exit order fees. Database decimal strings are processed as eight-place fixed-point integers to avoid floating point arithmetic drift.

**Do not treat this report as tax reporting.** It cannot yet account for wash sales, stock splits, transferred positions, specific-lot identification, incomplete historical purchases, broker-confirmed short-sale classification, missing corporate actions, borrow costs, or non-snapshot partial fills. Under the current user-selected reporting policy, imported Webull orders without fee rows are treated as **$0 fees** when computing provisional net P&L. Explicit imported fees and manually entered fees are still deducted. This is a journal calculation assumption, not independent fee verification. Short positions are represented by negative signed share balances. A SELL opens or extends short inventory only when there are no remaining long lots; a BUY first covers short inventory and then opens a long if it crosses through zero. A short sale of 100 shares followed by a 100-share buy-to-cover leaves **zero** open shares. The performance dashboard no longer displays all opening SELL transactions as an error: a short opening is expected when no earlier long shares exist, and no realized P&L accrues until it is covered. The dashboard now displays a **realized P&L by brokerage account** breakdown calculated using the immutable internal account ID for both imported executions and manual trades, with gross/net totals, closed shares and open symbol counts. Its labels are generated directly from the same stored Webull account type and external ID as the import page. These are provisional classifications: a first SELL can instead represent liquidation of older, unimported long holdings. Because the user has confirmed there are no additional pre-import holdings, the opening-sell warning is no longer displayed or used to suppress net P&L. An opening sell is therefore provisionally treated as a short; any missing transaction history could still change those results. Matched gross remains a partial provisional subtotal. Under the selected zero-fee policy, missing Webull fee rows no longer block the net P&L display. A 20,000-row safety cap prevents silent partial-ledger calculations.

The report is locked to localhost Next.js development until authenticated sessions exist. Run `npm test` to execute accounting and import unit tests.

## Next steps

- Verify live API order response and fee schema using your own account (no credentials in chat).
- Add broker execution-level data when available. Never infer individual fills from average prices.
- Design authenticated dashboard and background scheduling with bounded jobs.
- Reconcile provisional short-sale classifications and FIFO results against brokerage statements; add verified opening holdings, splits, transfers, borrow expenses, and correct fee availability flags.
- Build tax-lot cost basis and wash sale monitoring only after complete historical imports and review of corporate actions and cross-account trades.
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
