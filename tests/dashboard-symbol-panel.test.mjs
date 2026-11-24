import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../src/app/page.tsx',import.meta.url),'utf8');
test('Dashboard contains full-width Top symbols but not Daily P&L card',()=>{
 assert.match(page,/className="sj-dashboard-panels"/);
 assert.match(page,/Top symbols by known net/);
 assert.match(page,/href="\/ticker-pnl"/);
 assert.doesNotMatch(page,/dashboard-two-up sj-dashboard-panels/);
 assert.doesNotMatch(page,/<DashboardDailyBars/);
 assert.doesNotMatch(page,/RECENT ACTIVITY/);
});
