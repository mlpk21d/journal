# Trade Journal

Next.js / TypeScript / PostgreSQL / Webull Trading API. Read-only stock-order journal with historical-order synchronization, order-level fees, and a read-only potential wash-sale screening report.

## Install

```bash
npm install
cp .env.example .env.local
# fill DATABASE_URL, WEBULL_APP_KEY, WEBULL_APP_SECRET, JOURNAL_API_TOKEN, FMP_API_KEY
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
- `/` — local-only trade-history Dashboard with compact win/loss summary, completed FIFO trades paginated 50 per page, click-to-edit journal modal (shared with Trade Review), trading calendar, and Long vs Short and weekday performance panels; successful note saves close the modal without resetting failed drafts
- `/stats` — Statistics page: compact performance cards, verified FIFO trade metrics, rolling win-rate chart, daily realized bar chart, and data-quality notes
- `/calendar` — full-width Eastern Time realized trading calendar with month navigation, per-week known-net subtotals, monthly subtotal, and account selection
- `/risk-management` — local-only pre-trade position sizing for one selected Webull account; fetches USD net liquidation value and buying power through the existing signed Webull client and shared rate limiter; stock/ETF quotes use FMP stable /quote with server-only FMP_API_KEY in .env.local. No Webull market-data subscription needed. Vertical trade setup with shared dollar/percentage risk dropdown above margin and mode-specific ATR settings below margin, beside a dedicated position summary with compact refresh action and shared Long/Short control above one tabbed Quick/Precise calculator, stacked on narrow screens, and segmented direction controls and prominent share-count results; shared risk and cost settings. Responsive header with account equity, estimated margin-adjusted buying power (capped by Webull when available) and ticker quote beside title; selectable 1:1 through 6:1 margin exposure cap (2:1 default) without multiplying broker buying power; on-demand refresh with elapsed time, cached-data feedback, and retained previous values clearly marked illustrative on failure; 5-second quote and 15-second balance caches with in-flight deduplication. Immediate quick share estimate using 1.5× automatic FMP five-minute Wilder ATR(14), calculated from completed bars over a seven-calendar-day warmup (including any extended-hours bars returned by FMP); ATR cache per ticker until the next five-minute boundary plus 10 seconds (minimum 15 seconds), shared FMP 429 cooldown, and no automatic polling. Missing ATR disables quick sizing without blocking quote/balance or manual-stop sizing. Precise sizing supports automatic ATR, editable ATR override and multiplier (default 1.5×), or technical stop which takes precedence. Fixed dollar or account percentage risk mode and precise ATR multiplier saved per account in browser storage; editable entry, direction and estimated costs. ATR older than 15 minutes flagged. Intraday data access depends on FMP subscription. Stale or missing quote timestamps flagged. FMP quote access and latency depend on the subscription; no explicit extended-hours endpoint or streaming. FMP HTTP 429 triggers a separate cooldown. No orders placed.
- `/settings` — local-only workspace settings, starting with brokerage account listing and new manual brokerage account creation
- `/import` — local-only import interface, automatic account discovery, multi-account sync, and one-click import of today's transactions; header shortcut uses live Webull history scan, per-order progress, and DevTools Console status
- `/import/schwab` — Schwab Transactions CSV preview, account selection, deduplicated trade and service-fee import; ignores Wire Sent and unrelated cash rows; uses ordered synthetic 9:30 AM Eastern timestamps
- `/fees` — standalone brokerage fee ledger by account (manual fees and Schwab CSV Service Fees), separate from FIFO trade commissions
- `/manual` — local-only manual stock BUY/SELL and historical opening entries; uses accounts managed under `/settings`, with history scoped to the selected sidebar brokerage account
- `/trades` — read-only imported and manually entered transactions in six columns: Symbol, Side (green BUY/red SELL), Quantity (whole shares without trailing zeroes; fractional shares preserved), Avg Price (2 decimals), Fees (2 decimals), Filled Time (UTC); case-insensitive exact ticker filter (`/trades?symbol=NVDA`) applied to all stored history before database pagination (50 records per page)
- `/ticker-pnl` — sortable, paginated P&L by Ticker report with realized FIFO exits (including partial exits), verified known-net subtotals, gross P&L, known fees, completed trade stats, open positions, account scope and Eastern Time exit-date filters; click a ticker to audit exit matches
- `/performance` — localhost-development-only provisional FIFO realized P&L, per-account breakdown/filter, short covers and open journal lots
- `/review` — localhost-development-only completed flat-to-flat trade cycles and separate Eastern Time session reviews; global sidebar brokerage-account scope, ticker and exit-date filters; cookie-backed persistent column preferences and trade details/journal editing in a modal
- `/review/trade?id=...` — completed-trade FIFO audit plus independently saved strategy, setup, entry/exit reasoning, mistakes, lessons, HTTPS screenshot links and private screenshot uploads
- `/review/session?account=...&date=...` — read-only account/session detail with daily realized FIFO matches and contributing executions (optional `symbol=...`)
- `/analytics` — localhost-only completed-trade strategy analytics: win rate, net P&L, average net/trade, profit factor, direction and mistake documentation; ticker/account/direction/ET exit-date/strategy filters
- `/daily` — localhost-only daily realized FIFO P&L dashboard: known-net cumulative chart, interactive month-switchable trading calendar, per-day results, best/worst days and winning/losing streaks; account/date filters
- `/timing` — localhost-only completed trade entry/exit hour and weekday analytics, win rate, net P&L, average net P&L, and profit factor; account/ticker/direction/exit-date filters
- `/insights` — localhost-only consolidated historical performance insights with qualified strongest/weakest patterns, strategy, direction, entry/exit time and weekday comparisons, data-coverage safeguards, and configurable minimum sample
- `/wash-sales` — local-only potential wash sale screening across all saved brokerage accounts using long FIFO loss matches and +/-30 Eastern calendar days; reviewed-loss account filtering, replacement share estimates, IRA/cross-account flags; does not modify P&L or tax lots
- `/wash-sales/basis` — read-only FIFO adjusted tax-lot preview: tracked replacement portions, partial-share and chain loss deferrals, IRA flags, provisional adjusted long-sale outcomes, and remaining replacement basis; no database writes
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


## Desktop journal workspace redesign (November 2026)

The UI now uses a dark, desktop-first layout **based on the three screenshots supplied by the project owner**, with original Trade Journal branding. The desktop shell has a persistent left navigation sidebar, narrow quick-link rail, global ticker search, trade-entry shortcut, and compact top toolbar. All application pages inherit the shared layout and denser table, panel, form, and card styling. The sidebar links to real local pages; it does not include paid, unavailable, or placeholder routes from the design reference. The All Accounts control is now an interactive brokerage account selector, applied across the workspace.

The `/` Dashboard now starts with a compact status/P&L strip and a 30-completed-trade read-only FIFO table. The trade table links symbols to the existing detailed trade review. Below it, the existing trading calendar (previous/next month) and side-by-side daily P&L / symbol panels remain accessible. Dollar amounts come from the existing FIFO model, not the screenshot. Neither cash, active balance, market exposure, wash-sale totals, nor unverified brokerage metrics are fabricated.

The new `/stats` screen reuses existing exact fixed-point summary and risk calculations, shows 16 compact metrics and provides an interactive 10/20/50/100-trade rolling win-rate chart based on verified completed-trade net results. The `/calendar` screen uses the same data as Daily Performance, with a large eight-column calendar that includes weekly known-net subtotals. Month selection and Today operate in Eastern Time; the view may be filtered by a brokerage account. Unknown P&L is not treated as zero. The screenshots guided the appearance and information hierarchy, but third-party brand identity and unsupported commercial tools were not copied.

This first design pass intentionally preserves Webull imports, manual brokerage accounts, FIFO logic, trade review, annotations, and the original analytics routes. UI access continues to be restricted to local development where those pages require it. No migrations or new dependencies are introduced.


## Workspace account scope, Settings, and quick-entry modal

The left-sidebar **All Accounts** button expands a list of every saved Webull and manually created brokerage account. Choosing one saves the selection in the `trade-journal-active-account-v1` browser cookie and refreshes the current route. Returning to **All Accounts** restores the combined view. Account scope is enforced at database query/FIFO data-loading time, **before** position matching or report aggregation, so the following pages use only the selected account's executions: Dashboard `/`, Statistics `/stats`, Calendar `/calendar`, Trade History `/trades` (including its SQL pagination total), Trade Review `/review`, the daily/strategy/timing/insights/risk reports, and the realized performance report. Manual trade history is also filtered by the active account. Report-level account dropdowns have been removed in favor of the sidebar as the single source of truth; report-specific symbol/date/direction filters remain available. The chosen account persists across route navigation and reloads in the same browser. If the selected account is removed from the database, choose All Accounts to clear a stale cookie.

The Dashboard **+ Add Trade**, top-toolbar **+ New Trade**, and completed-trade empty-state **Add Trade** controls now open the same in-page modal. This modal reuses the validated `ManualTradeEditor` save action; it preselects the active brokerage account when one is chosen, closes after successful save, and refreshes performance tables. It does not create brokerage orders or invoke Webull imports.

**Brokerage account creation** has moved out of `/manual` into the new `/settings` Workspace section. The Settings page lists all saved accounts and includes a form to add an independent named manual brokerage account without API credentials. Additional workspace settings can be added here later. Manual Trades remains the full-page editor and trade-history manager. Webull's import page continues to let the operator select which Webull account(s) to synchronize because import target selection is a distinct write/import action, rather than a trading report filter.

**Safety and integrity:** Global account selection is a local UI preference, not user authorization; until authentication is implemented the application must remain localhost-only. FIFO matching is scoped to the full available execution history **for the selected account** before date/symbol filters. This change does not alter fees, cost basis, journal entries, or execution records. No new schema migration is required.

## Initial wash sale screening (read-only)

Open `/wash-sales` from the Research sidebar or Realized Performance page. This is **phase 1**: a read-only screening view, not an IRS tax calculation or a Form 8949 export.

- The existing FIFO engine identifies loss-making **LONG** lot closures (fees included where the net loss is known). The screen considers **same-symbol BUY shares** acquired from 30 calendar days before to 30 days after each loss sale, inclusive; Eastern Time calendar dates determine the window. For purchases **before** the loss sale, only shares still held after that sale can qualify as replacements. For purchases **after** the loss sale, shares opening a new long position can qualify. Shares used to cover shorts are excluded. Potential replacement quantity is capped to matched losing shares and each acquisition is reserved only once in this screening pass.
- **Replacement search includes every stored brokerage account** regardless of the sidebar account. The sidebar selects which **loss sales** appear. Cross-account and possibly retirement-account purchases are marked. The display offers ticker and loss-year filtering. If fewer than 30 days have elapsed since a loss, a warning notes the window remains open.
- Reported estimated flagged amounts are *indicators*, not confirmed wash-sale disallowances. The preview does not write to `tax_lots` or `wash_sale_adjustments`, change realized P&L, increase replacement basis, adjust holding periods, or permanently disallow IRA replacement losses. It does not handle short-sale wash rules, options/contracts, corporate actions, unrecorded brokers, incomplete or missing lots, or cross-symbol substantially identical securities. It also does not perform repeated-chain tax-lot allocation. Webull snapshots are averaged orders, not actual exchange-level fills. These limitations prevent relying on this output as tax filing evidence.
- The database has preexisting `tax_lots` and `wash_sale_adjustments` schema groundwork. Do **not** populate them with speculative candidate data; a separate reconciled tax-lot basis engine is the next milestone. Before tax-ready reporting, verify consolidated broker 1099-B records, acquisition and transfer history, account retirement status, short sales, capital gain holding periods, replacement lots, and year-end windows.
- Sources: [IRS Publication 550](https://www.irs.gov/publications/p550) and [Form 8949 instructions](https://www.irs.gov/instructions/i8949). No new migration is required.

## Wash-sale tax-lot preview — phase 2

The `/wash-sales/basis` page provides an **independent, read-only calculation** over full execution history for ALL saved accounts, even when the sidebar selects one. The sidebar filters *displayed sales* and open lots. The calculator splits purchase orders into consumed and still-open portions, attributes same-symbol replacement purchases within +/-30 Eastern calendar days of losing long sales, carries disallowed losses into replacement purchase portions, and uses the increased basis on subsequent sales. **Chained wash sales** are modeled when a replacement itself sells at a loss and another purchase triggers a further deferral.

The page compares original and estimated adjusted long-only FIFO net proceeds, allocated disallowances, IRA treatment, provisional holding-period origin, and remaining wash basis on open shares. IRA/Roth IRA losses are flagged without increasing IRA basis. Dispositions made inside an IRA/Roth IRA are excluded from the taxable sale subtotal; IRA acquisitions can still trigger disallowance for a taxable-account loss. Original purchase cost in the open-lot table excludes buy fees and is not certified tax basis.

**Not tax ready:** short-sale wash rules, options and substantially identical other instruments, corporate actions, transfers, missing prior history, specific-lot elections, spousal brokerage accounts and broker 1099-B reconciliation. All original trading P&L remains unchanged. The system does not write to `tax_lots` or `wash_sale_adjustments`. Review estimates against complete broker statements and consult a tax professional before filing. No migration is required in this phase.

## Dashboard metric bars and planned tax imports

The Dashboard status strip now calculates proportional bar widths instead of a hardcoded 65% fill. Counts (wins, losses, open positions, and potential wash-sale loss dispositions) are scaled against the highest count; average winner/loser dollar amounts are scaled against the larger absolute average. Every zero or unavailable value displays a 2%-width color marker on the left, so the color remains visible without inventing activity. The FLAT counter has been replaced with **WASH SALES**, counting distinct loss-sale executions flagged by the existing read-only, same-symbol wash-sale screening model. The count is scoped to the selected brokerage account's loss sales while replacement purchases are screened across all saved accounts; it is preliminary, not an IRS-confirmed count or amount. An unavailable screening result displays an em dash rather than zero, without preventing the remaining Dashboard from loading.

Under **Settings**, a **Tax Imports** section now documents the planned CSV/1099-B import and reconciliation workflow. It is an informational placeholder only—no upload UI, database writes, or reconciliation actions have been enabled. The route index and existing report destinations are unchanged.


## P&L by Ticker

Open `/ticker-pnl` from the sidebar or use **All tickers** in the Dashboard Top Symbols section. This report aggregates every available symbol using the same account-isolated FIFO lot matching engine as Realized Performance. Unlike completed flat-to-flat cycle reports, ticker realized P&L includes partial exits from positions still open. Completed trade count, win rate, average completed trade and profit factor are shown separately and never added to realized amounts.

The table provides 50-ticker pagination, sortable columns, ticker search, from/to exit-date filters in America/New_York, and persistent sidebar account selection. FIFO is reconstructed from all available historical transactions before date or ticker filtering, protecting opening basis. Click a symbol to show underlying FIFO closures and a link to completed Trade Review.

**Accuracy:** Any symbol with an unknown-net FIFO closure is marked Unverified. Net is explicitly a known subtotal rather than a complete total; known fees derive only from verified matches. A ticker can have an open position with no realized exits. Reporting is preliminary, not account equity, tax-adjusted wash-sale P&L or unrealized P&L. Page is localhost-only and honors the 20,000-execution safeguard. No migration or new package is required.

## One-click header Webull import: today's trades

The global toolbar now has **Import Todays Trades** between the symbol search and New Trade buttons. It is available **only** when the sidebar has one saved Webull brokerage account selected. Choosing All Accounts or a custom/manual account disables this action; the **server action also validates the selected internal brokerage account ID and Webull broker type**, so the restriction cannot be bypassed with a request.

A click opens a blocking screen overlay with a spinner during the Webull synchronization. The server uses the existing read-only `importWebullOrders` pipeline and its account-specific advisory lock, applying the full current **America/New_York** calendar day as UTC start/end (correct across 23-hour and 25-hour DST transition days). After completion it opens a result dialog displaying **new execution snapshots imported**, **previously stored snapshots updated**, total completed snapshots processed, and scanned orders. The importer's `newExecutions` statistic distinguishes genuinely new execution rows from upserted existing rows; existing import summaries keep their original saved/updated semantics. An error displays a failure dialog rather than a misleading zero count. On success, the page data refreshes. Re-running today's import updates prior records without creating duplicate snapshots. This control does **not** place any broker orders.

As with the rest of the Webull browser importer, the button is **localhost development only**; authentication and authorization must be added before internet deployment. Source and visual entry point are indexed here. No database migration is needed.

## Dashboard completed trade history — pagination and modal

The Dashboard's Completed Trade History now shows the **50 most recent completed FIFO trade cycles per page**, with First / Previous / Next / Last controls and a visible page number and total trade count. All completed trades remain available, not just the latest 30. Ticker symbols open the **existing Trade Review modal** in place; the same saved journal form, fingerprint validation, strategy/setup/reasoning notes, screenshots, FIFO matches and execution details are available. Closing the modal restores focus to the clicked ticker. Imported Webull fills and manual executions are not editable from this journal editor; only independently stored journal annotations can be saved. No migration is needed.

## Streaming Import Today progress and browser console

The header **Import Todays Trades** shortcut now streams progress from `POST /api/webull/import-today` as newline-delimited JSON, under the same local-development + same-origin and selected-Webull-account restrictions. The server first scans all pages of today's Webull history to establish the **total number of order records**, then queries existing Webull execution snapshots for that account to count **previously imported** records *before* processing. This initial scanning phase uses an indeterminate progress indicator, not an invented percentage. Once the total is known, a determinate bar advances after **each committed order** (`processed / total`). Empty history completes with 0 records. The snapshot importer is still idempotent, and updates existing snapshots rather than inserting duplicates.

Open browser Developer Tools → Console before clicking the header import. A log entry is produced for **every processed order** with symbol, side, filled quantity, average price, fill timestamp, broker order ID, progress and `result: 'new' | 'updated' | 'skipped'`. `alreadyImported: true` indicates an existing execution snapshot being refreshed; partial/cancelled/unreconstructible orders are skipped. The live overlay shows initial previously imported count, new/updated/skipped counters and percent. The completion dialog retains the separate new-versus-updated totals. The source `importWebullOrders` function shares these counts through an optional progress callback for the header route, while the existing `/import` workflow remains available. No schema migration is required. Note: the denominator counts Webull *order records*, not necessarily filled trade executions; the completed snapshot count can be smaller.

## Trade journal modal save behavior

The shared completed-trade journal editor (opened by clicking a ticker on the Dashboard or Trade Review table) saves journal notes without native form-action input resets. **A successful server-confirmed save closes the modal**, returning to the same list; **a validation or network failure keeps the modal open and retains the entered field values** so they can be corrected or retried. The standalone `/review/trade` editor remains on its page and displays the save confirmation. Imported orders and FIFO accounting remain unchanged. No migration is required.


## Charles Schwab CSV import and standalone fees

Run `npm run db:migrate` to apply **008_schwab_account_fees.sql** before importing. In **Settings → Add a Brokerage Account**, choose **Charles Schwab (CSV import)** and name your account. Then open `/import/schwab`, select that Schwab account (or an existing manual account), upload a Schwab **Transactions CSV**, and inspect the preview. A checked confirmation is required before database writes. The existing Webull account cannot be selected for Schwab CSV imports.

The importer handles **Buy**, **Sell**, **Sell Short**, and **Buy to Cover** as BUY/SELL execution snapshots in their chosen account. Because the Schwab export has no intraday timestamps, it reverses Schwab's newest-first CSV order into chronological sequence, then assigns successive morning Eastern Time timestamps starting **09:30:00** for each day. These are visibly labeled *synthetic estimates*. This can change FIFO match order for complex same-day trading; check statements before using realized P&L as definitive. Imported trade commissions (`Fees & Comm`) are attached to their respective broker order and deducted through the existing FIFO fee allocation. The stored raw payload marks the synthetic time and includes the original action, description, and source CSV line number. Identical reimports are deduplicated using stable row-content occurrence keys and count previously imported rows separately, without overwriting prior snapshots.

**Wire Sent** rows are excluded entirely. **Service Fee** rows (including the two `$15.00` wire fees in the supplied example) go into the new `account_fees` table, **not** the FIFO trade executions. `MoneyLink Transfer`, `Wire Funds Adj`, `Credit Interest`, and other unsupported cash actions are also excluded. CSV preview reports counts before importing; the full file is committed in one database transaction or rolled back on error. Personal CSV data is never checked into the repository.

Use `/fees` to add separate charges, such as an $8 Webull fee, Schwab $15 fees, or a $50 account fee, with account, date, type and description. The table shows imported Schwab fees and manually entered fees by sidebar account. Imported fees cannot be accidentally deleted as manual fees. **These account fees are reported separately and not subtracted again from FIFO trade P&L; trade commissions are already accounted for in FIFO.** The account fee total is independent of net realized trading profit. Existing `/performance`, `/review` and shared review ledger queries now include the `schwab_csv` execution source while preserving full-history FIFO processing and existing limits.

## Dashboard symbol panel layout

The Dashboard no longer shows the Daily P&L component beneath the Trading Calendar. The remaining **Top symbols by known net** panel occupies the full available width (no two-column grid), with its **All tickers** link preserved. The separate `/daily` reporting page and its underlying calculations are unchanged.


## Dashboard Long vs Short and weekday performance

The Dashboard former Top Symbols panel is replaced by side-by-side Long vs Short and Day of Week panels. Metrics use completed flat-to-flat FIFO cycles. Long/Short shows trade count, verified known net, win rate and average win/loss. The weekday chart shows Monday to Friday only, net P&L, trades and win rate by **entry weekday in Eastern Time**, excluding weekend entries from the chart. Trades with unknown net contribute to trade count but not known P&L or win rate. Other analysis routes remain available. Favicon uses a diamond emblem matching the existing sidebar brand mark. No migration needed.

Dashboard weekday panel styling: the dark weekday-chart body stretches to the bottom of its card, even when the adjacent Long vs Short card determines the row height. The chart data and calculations are unchanged.
