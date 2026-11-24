import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validTradeDate} from '../src/lib/review/trade-date.ts';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('trade dates reject impossible dates and accept leap days',()=>{
 for(const date of ['2026-11-24','2024-02-29','2026-03-08','2026-11-01'])assert.equal(validTradeDate(date),true,date);
 for(const date of ['2026-02-29','2026-04-31','2026-13-01','2026-00-01','2026-11-00','2026-1-2','nope'])assert.equal(validTradeDate(date),false,date);
});
test('every active calendar cell links to day transactions including All Accounts',()=>{
 const calendar=read('src/components/trading-calendar.tsx');
 assert.match(calendar,/day.closures>0&&<Link className="calendar-day-link"/);
 assert.match(calendar,/href=\{'\/trades\?date='\+day.date\}/);
 assert.doesNotMatch(calendar,/\/review\/session\?account=/);
});
test('day history retains sidebar scope, date on pagination, and DST-aware exclusive next midnight',()=>{
 const trades=read('src/app/trades/page.tsx');
 assert.match(trades,/account=await activeAccountId\(\)/);
 assert.match(trades,/e.brokerage_account_id=\$2::bigint/);
 assert.match(trades,/m.brokerage_account_id=\$2::bigint/);
 assert.match(trades,/history.executed_at >= \(\$3::date::timestamp AT TIME ZONE 'America\/New_York'\)/);
 assert.match(trades,/history.executed_at < \(\(\$3::date \+ 1\)::timestamp AT TIME ZONE 'America\/New_York'\)/);
 assert.match(trades,/date\?\{date\}:\{\}/);
 assert.match(trades,/\[symbol\|\|null,account,date\|\|null,PAGE_SIZE/);
});
