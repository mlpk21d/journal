import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('main app shell provides working navigation to all screenshot-inspired pages',()=>{
 const nav=read('src/components/navigation.tsx');
 assert.match(nav,/href:'\/stats'/);
 assert.match(nav,/href:'\/calendar'/);
 assert.match(nav,/href:'\/review'/);
 assert.match(nav,/href:'\/import'/);
 assert.match(nav,/href:'\/manual'/);
 assert.match(nav,/role="search"/);
 assert.doesNotMatch(nav,/AI Coach|Broker Sync|Migrate from V1/);
});

test('dashboard retains FIFO summary, trade history and calendar',()=>{
 const home=read('src/app/page.tsx');
 assert.match(home,/buildTradeReview\(source\.entries\)/);
 assert.match(home,/<DashboardTrades trades=\{trades\}/);
 assert.match(home,/<TradingCalendar days=\{data\.daily\.days\}/);
 assert.doesNotMatch(home,/RealizedRiskChart|DailyPnLChart/);
});

test('statistics and full calendar only use locally reconstructed FIFO history',()=>{
 const stats=read('src/app/stats/page.tsx');
 const calendar=read('src/app/calendar/page.tsx');
 for(const page of [stats,calendar]){
  assert.match(page,/reviewIsLocal\(\)/);
  assert.match(page,/loadReviewLedger\(/);
  assert.match(page,/buildTradeReview\(source\.entries\)/);
 }
 assert.match(stats,/<RollingWinRate/);
 assert.match(calendar,/expanded\/>/);
});
