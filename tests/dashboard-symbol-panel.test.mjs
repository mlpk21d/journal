import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Dashboard replaces Top Symbols and Daily P&L with Long vs Short and weekday panels',()=>{
 const page=read('src/app/page.tsx');
 const panels=read('src/components/dashboard-breakdown-panels.tsx');
 assert.match(page,/DashboardBreakdownPanels data=\{buildDashboardBreakdown\(trades\)\}/);
 assert.match(panels,/className="sj-dashboard-panels sj-breakdown-grid"/);
 assert.match(panels,/LONG VS SHORT/);
 assert.match(panels,/DAY OF WEEK/);
 assert.match(panels,/When you trade/);
 assert.doesNotMatch(page,/Top symbols by known net/);
 assert.doesNotMatch(page,/<DashboardDailyBars/);
 assert.doesNotMatch(page,/RECENT ACTIVITY/);
 assert.doesNotMatch(page,/dashboard-two-up sj-dashboard-panels/);
});
