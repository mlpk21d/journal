# Project file index

| Task | Start here | Related files |
|---|---|---|
| Trading calendar and day navigation | `src/components/trading-calendar.tsx`, `src/app/calendar/page.tsx` | Active dates link to `/trades?date=YYYY-MM-DD`; shared with the dashboard. |
| Daily transaction list | `src/app/trades/page.tsx` | `src/lib/review/trade-date.ts`, `tests/trade-calendar-day.test.mjs`; Eastern midnight boundaries, ticker/date filters and pagination. |
| Selected brokerage account | `src/lib/review/account-scope.ts` | `src/components/navigation.tsx`; calendar and trade history both use the sidebar cookie. |
| Pre-trade Risk Management | `src/app/risk-management/page.tsx`, `src/components/risk-calculator.tsx` | `src/features/risk-management/actions.ts`, `src/lib/risk/webull-data.ts`, `src/lib/risk/position-size.ts`, `tests/position-size.test.mjs`; selected Webull account, shared Webull limiter, FMP quotes via `src/lib/risk/fmp-data.ts`, parser `src/lib/risk/fmp-quote.ts` and `tests/fmp-quote.test.mjs` (Node native TypeScript stripping compatible), browser dollar/percentage risk mode and precise ATR multiplier; automatic FMP 5-minute Wilder ATR(14) snapshot (1.5×), manual ATR override and technical stop precedence; `src/lib/risk/intraday-atr.ts`, `tests/intraday-atr.test.mjs`, `tests/risk-calculator-layout.test.mjs`; 1:1–6:1 margin exposure cap (2:1 default), title-side account/quote summary, vertical market setup with shared dollar/percentage risk tabs above margin, beside a dedicated active-mode position summary above the shared Quick/Precise tab panel and segmented direction controls, responsive stacking, conditional stale-data warning and refresh status styles in `src/app/globals.css`. |
| Setup and feature documentation | `README.md` | `package.json`, `migrations/`, `tests/`. |

Calendar dates show realized exits; their day link lists all imported and manual transactions executed on that Eastern date, including entries. All Accounts remains All Accounts. Switching the sidebar account refreshes the same date with the new scope. Pagination and ticker filtering preserve the date.
