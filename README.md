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
- `/` — local-development-only live trading dashboard with KPI cards, month-switchable trading calendar, daily P&L bars, long/short and ticker comparison, and recent trading sessions
- `/import` — local-only import interface, automatic account discovery, multi-account sync, and one-click import of today's transactions
- `/manual` — local-only generic manual stock BUY/SELL and historical opening entries, plus create and select separate manually managed brokerage accounts
- `/trades` — read-only imported and manually entered transactions in six columns: Symbol, Side (green BUY/red SELL), Quantity (whole shares without trailing zeroes; fractional shares preserved), Avg Price (2 decimals), Fees (2 decimals), Filled Time (UTC); case-insensitive exact ticker filter (`/trades?symbol=NVDA`) applied to all stored history before database pagination (50 records per page)
- `/performance` — localhost-development-only provisional FIFO realized P&L, per-account breakdown/filter, short covers and open journal lots
- `/review` — localhost-development-only completed flat-to-flat trade cycles and separate Eastern Time session reviews; ticker, account and exit-date filters; wide completed-trades table, cookie-backed persistent column visibility preferences (ticker/direction/net P&L mandatory), and trade details/journal editing in a modal
- `/review/trade?id=...` — completed-trade FIFO audit plus independently saved strategy, setup, entry/exit reasoning, mistakes, lessons, HTTPS screenshot links and private screenshot uploads
- `/review/session?account=...&date=...` — read-only account/session detail with daily realized FIFO matches and contributing executions (optional `symbol=...`)
- `/analytics` — localhost-only completed-trade strategy analytics: win rate, net P&L, average net/trade, profit factor, direction and mistake documentation; ticker/account/direction/ET exit-date/strategy filters
- `/daily` — localhost-only daily realized FIFO P&L dashboard: known-net cumulative chart, interactive month-switchable trading calendar, per-day results, best/worst days and winning/losing streaks; account/date filters
- `/timing` — localhost-only completed trade entry/exit hour and weekday analytics, win rate, net P&L, average net P&L, and profit factor; account/ticker/direction/exit-date filters
- `/insights` — localhost-only consolidated historical performance insights with qualified strongest/weakest patterns, strategy, direction, entry/exit time and weekday comparisons, data-coverage safeguards, and configurable minimum sample
- `/risk` — localhost-only Risk & Trade Quality: winner/loser averages, payoff ratio, loss streaks, verified-segment realized drawdown, largest winner concentration, and profitability by holding duration; account/ticker/direction/exit-date filters

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

## Trade Review architecture

Open **/review** on localhost in Next.js development mode. The **Completed trades** tab treats an account/symbol position from flat to flat as one trade, including several BUY/SELL orders and partial exits. A position reversal closes the first trade and begins a new one. Only fully completed position cycles appear here; open positions with realized partial exits appear in **Trading sessions**. The account filter keeps inventory isolated; the ticker filter narrows to a symbol's complete history (FIFO positions are symbol-isolated); exit-date filtering is applied only **after** FIFO matching. Trade dates and daily session boundaries use **America/New_York**, including daylight saving adjustments; displayed execution timestamps remain UTC.

The review layer in \`src/lib/review/trade-review.ts\` consumes the unchanged \`buildLedger\` output. Trade entry/exit prices are quantity-weighted from matched FIFO shares and may differ from a simple average of all orders. Aggregate trade gross and net are sums of the original FIFO matches; allocated fees equal gross minus net and are not subtracted again. Webull missing fees follow the same $0 policy as \`/performance\`. The session view aggregates FIFO realized closures by exit date and brokerage account, including partial exits of still-open positions. Closure count means number of FIFO lot matches, not number of order executions.

Trade IDs are stable within a given input history and based on brokerage account, symbol, first opening execution ID, and direction. They are **derived identifiers, not permanent database keys**: importing older orders or editing manual entries can rebuild position cycles. Before attaching persistent notes, screenshots, or strategies, add a review metadata model with a durable cycle identity and reconciliation/migration policy. Do not store annotations in imported execution or order tables. Both views are read-only; there is no database migration or change to Webull imports, original fee rows, or FIFO calculations. A 20,000-row safeguard prevents incomplete historical basis from being displayed as complete. Run \`npm test\` and \`npm run typecheck\` to verify the feature.

### FIFO review drill-down and reconciliation

Click a ticker on the **Completed trades** table to open its audit, or click a session date in **Trading sessions** to inspect daily realized matches. Both are localhost-development-only, read-only pages with gross, net and allocated fees, individual FIFO matches and the participating source executions. A session may display an opening execution from an earlier date because that lot was closed during the selected session. The order-fee column on executions is not the portion allocated to a particular match; the totals always use the unchanged FIFO allocation. Reversal orders may participate in two trades, so their raw fee may appear in both detail pages; it is **not counted twice** in the ledger.

Review detail IDs are derived from the reconstructed position cycle. They are not permanent identifiers for attaching notes or screenshots, and may change when older history is imported. Both detail pages enforce the same 20,000-execution history guard and local-development restriction as the overview, and never write to Webull tables. Run \`npm test\`, \`npm run typecheck\` and \`npm run build\` after pulling changes.

### Persistent trade journaling (migration 006)

Run `npm run db:migrate` to create `trade_journal_entries`, then visit a completed trade from `/review`. Use **Save journal entry** to keep a strategy, setup description, entry and exit reasoning, mistakes, lessons, and one HTTPS screenshot link. Screenshot bytes are not uploaded or stored by this release. Only metadata is saved; imported executions, fees, orders and FIFO accounting remain unchanged. Editing uses the same localhost-only development restriction and same-origin check as manual trades.

Each entry has a persistent database UUID; `cycle_key` is a lookup key, **not** a durable identity. An SHA-256 fingerprint guards the exact completed-trade execution composition and values. If later import history changes the cycle under the same lookup key, existing notes are preserved and editing is blocked. If the trade lookup key itself changes, the journal record remains in the database but will need manual reconciliation; automatic migration to another trade is deliberately avoided. Durable annotations should not be interpreted as tax-lot attribution. The journal is for development-only use pending application authentication and authorization. Screenshot links are external and should not contain secrets.

Run `npm test`, `npm run typecheck`, and `npm run build` before use.

### Trade Review table and modal interaction

The **/review** page uses a wider responsive container (up to 1900px) to accommodate the completed-trades table while other pages retain their previous widths. On smaller screens, the table scrolls horizontally rather than crushing numeric and date columns. Use **Columns** to show or hide optional columns; **Ticker**, **Direction** and **Net P&L** are always visible. Preferences are stored in the current browser's localStorage; **Show all columns** resets the view. There is no schema migration for these settings.

Click a ticker to open an accessible, scrollable trade review modal with the original FIFO audit, contributing executions, and saved trade journal fields. The modal fetches only the selected trade's detail through a server action restricted to localhost development, preserving the existing fingerprint checks and read-only Webull data. Escape and the close control dismiss the modal without leaving the page. The legacy direct `/review/trade?id=...` address remains available for bookmarks, but normal review now happens in the modal.

### Private chart screenshots (migration 007)

Apply `npm run db:migrate` for migration 007. Open a reviewed trade, save its journal entry, then reopen the modal to upload chart screenshots. Supported files: PNG, JPEG, WebP (signature checked), up to 5 MB per image and 10 images per journal. Screenshots have thumbnails, open-in-new-tab links, and deletion controls in the Trade Review modal. The existing HTTPS screenshot URL field remains supported. File metadata is stored in PostgreSQL but file bytes are saved outside `public/`, by default in `data/trade-screenshots/` relative to the application working directory. Set `JOURNAL_UPLOAD_DIR` to an absolute persistent local directory if needed. Back up **both** PostgreSQL and the screenshot directory. The image and mutation endpoints are restricted to local development requests; uploads and deletes additionally require same-origin requests and the matching current trade fingerprint. Do not expose the Next.js development server to the public internet. Image files are not stored in Git. Screenshot deletion removes the file and its metadata but does not modify broker executions or FIFO matching.

### Strategy analytics

Open \`/analytics\` to review completed position cycles from the existing FIFO ledger, not raw BUY/SELL order counts. KPIs cover completed trades, verified net-P&L trades, win rate, net realized P&L, average net per verified trade, profit factor and win/loss/breakeven counts. The dashboard breaks down by strategy, direction and whether a mistake is recorded. Use ticker, brokerage account, direction, Eastern Time exit-date range or strategy filters. All FIFO calculations use full available historical positions before filters are applied.

Journal annotations only count as belonging to a strategy if the saved fingerprint still matches the completed trade. Missing annotations appear as **Unreviewed** and changed fingerprints as **Changed history**. Unverified net P&L is excluded from monetary averages, win rate and profit factor; no fictitious zero-value trades are created. A zero-net trade is a breakeven and remains in the win-rate denominator. Profit factor is positive net wins divided by absolute net losses; “∞” denotes gains without losses. Mistake notes are free text; for this version the analysis distinguishes recorded / none recorded / not reviewed, rather than treating each prose sentence as a standardized mistake category. The existing 20,000-execution history guard applies. No new migration, Webull write access or tax-lot adjustments are introduced.

### Daily Performance dashboard

Open \`/daily\` from the navigation menu or homepage. The page computes an Eastern Time daily realized-P&L report from the same account-isolated FIFO matches as \`/review?view=sessions\`, including partial exits from positions that have not fully closed. Results from different accounts on the same date are aggregated only after FIFO calculation. The cumulative chart is a **known-net subtotal**, not actual account equity or a complete P&L history if any days have unknown fees. Any date with an unknown account session net is displayed as **Unverified**, is excluded entirely from the subtotal, and interrupts winning/losing streaks. Zero-net days also interrupt streaks; days without realized exits do not count as trading days. Summary includes active days, verified and unverified days, best/worst dates and longest streaks. Date filters are applied **after** constructing positions from full historical executions. The calendar month selector controls only the displayed month, while From/To filter the entire dashboard. No additional database migration or third-party charting dependency is required.

### Trade Timing Analytics

Visit \`/timing\` from the homepage or hamburger menu to analyze completed flat-to-flat positions by **entry hour**, **final exit hour**, **entry weekday**, and **final exit weekday** in America/New_York. Hourly buckets are chronological, including premarket and after-hours executions; weekdays are ordered Monday through Sunday. Trade-level net amounts and statistics reuse the same fixed-point calculation and unknown-fee exclusion as Strategy Analytics. Each completed position cycle is counted once in each grouping. Multiple entries and partial exits are **not** counted separately, nor are realized partial exits of still-open trades; visit \`/daily\` for those. Filters on ticker, account, direction and final-exit Eastern Time dates apply *after* reconstruction from full available FIFO history. DST is handled by IANA time zone conversion. Analytics are historical and provisional, not a predictive signal or tax ledger. No migration or extra charting package is required.

### Trading Performance Insights

Open \`/insights\` from the hamburger menu or homepage to compare historical results across **strategy**, **trade direction**, **entry hour**, **exit hour**, **entry weekday**, and **exit weekday**. Categories reuse the completed flat-to-flat FIFO trade engine and the same fixed-point net P&L metrics as Strategy Analytics. Strategies are included only for journal annotations with matching current-trade fingerprints. You can filter account, ticker, direction and final Eastern Time exit dates after reconstructing full available FIFO history.

The dashboard distinguishes **qualified** and **insufficient** comparison groups. Default qualification requires **20 completed trades with verified net P&L** and **at least 80% verified net coverage**; you can set the minimum between 2 and 500 to explore sample sensitivity. Strongest and weakest group rankings sort by **average net P&L per verified trade** rather than gross dollars. Unknown P&L never becomes zero and unverified trades do not count toward the minimum. The rankings require at least two qualified groups and do not repeat a top-listed group in the bottom list.

Groups overlap across dimensions: a single trade contributes to its strategy, direction, entry time, exit time, and weekday buckets. These results are **descriptive**, vulnerable to selection bias and small-sample noise, and must not be interpreted as an independently validated trading edge, statistical significance, or future prediction. No new migrations, broker writes, or execution/FIFO mutations are involved.

### Risk and Trade Quality Analytics

Open `/risk` from the homepage or navigation menu. Results use completed flat-to-flat FIFO trades and share the same verified-net exclusion policy as Strategy Analytics. The page reports average winner (positive net trades), average loser (negative net trades), payoff ratio (average winner divided by the absolute average loser), largest individual winner/loser, largest winner's percentage of all positive trade P&L, longest/current consecutive losing trades, and average net trade. A position that is only partially exited does not count as completed; see `/daily` for partially realized activity.

Drawdown is **maximum realized P&L peak-to-trough loss inside contiguous verified completed-trade segments**, not account-equity or mark-to-market drawdown. Unknown-net trades break the curve and reset peak/streak calculations; they are never silently treated as zero. Flat trades also reset loss streaks. Filters reconstruct FIFO from full available account history **before** selecting trade exits; changing a filter changes the starting observation point for drawdown. Holding-duration buckets are under 5m, 5–15m, 15–60m, 1–4h, 4–24h, and 24h+, with lower-inclusive/upper-exclusive boundaries. No database migration, external chart dependency, or broker writes are required.

### Home trading dashboard

The homepage (`/`) now loads the current local PostgreSQL trade history and displays a read-only trading dashboard in development on localhost. It reuses the same full-history FIFO engine, completed trades, and Eastern Time realized sessions as `/review`, `/analytics` and `/daily`. Metrics include known realized daily net subtotal, completed-trade win rate, profit factor and average trade, active exit days, open FIFO positions, and unknown-net data counts. Charts show cumulative known daily net, active trading-day bars for the latest 30 calendar days relative to the most recent exit date, completed-trade net by direction, top symbols, and recent exit-day summaries.

The chart and daily net subtotal include realized partial exits of positions still open. Completed-trade win rate, average trade and symbol/direction comparisons include only fully completed flat-to-flat trades. Daily totals for any date with unknown net are excluded entirely from the cumulative known net subtotal; completed trades with unknown net are excluded from financial averages and counts of verified winners. Consequently daily realized sums and completed-trade totals can legitimately differ. This report is not an account equity curve, reconciled tax return, or wash-sale-adjusted ledger.

The homepage uses the same 20,000-execution safeguard as other reports and shows an informative empty/error state. For now it stays restricted to localhost development; production authentication is required before exposing private trade performance data. No new database migration or external charting library is needed.

### Interface updates

All application page shells use 85% of desktop viewport width (with responsive mobile margins). The trade history table now uses 50-row SQL pagination with stable ordering, total counts, and ticker-preserving page controls. The import page offers an immediate **Import Today's Trades** action for the chosen Webull account(s). Manual Trade entry can create named standalone brokerage accounts, without adding them to the Webull account cache; the manual accounts are reused across FIFO and trade analytics. Strategy inputs offer suggested names, and the analytics dropdown includes common strategy options. The dashboard shares the Risk page's realized segment chart. The trade modal uses denser spacing and smaller inputs. Review table column settings persist in a one-year same-site cookie read by the server and updated immediately on selection; browser privacy policies can block cookies. No new migration is needed with the existing generic `brokerage_accounts` schema.

### Shared trading calendar controls

The homepage (`/`) no longer renders the cumulative known-net line chart or the realized P&L/drawdown-segment chart; those remain available on `/daily` and `/risk` respectively. Instead, the Dashboard shows the same Eastern Time trading calendar as `/daily`. Both pages use a shared client component with **Previous Month**, **Next Month**, and native month picker controls. Month changes are immediate, require no server request and do not re-run FIFO calculations or modify the current `/daily` account/From/To report filters. Calendars show winning days green, losing days red, unknown net amber, breakeven days neutral and days without exits dimmed. The default calendar month is the latest available realized exit month (or current UTC month when there are no exits). The daily page retains its separate cumulative known-net chart. No migration or new package is needed.
