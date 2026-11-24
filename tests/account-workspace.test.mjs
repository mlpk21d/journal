import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('account selector saves server-readable same-site cookie and refreshes route',()=>{
 const nav=read('src/components/navigation.tsx');
 const shared=read('src/lib/review/account-scope-shared.ts');
 const server=read('src/lib/review/account-scope.ts');
 assert.match(shared,/trade-journal-active-account-v1/);
 assert.match(nav,/document\.cookie=ACCOUNT_COOKIE/);
 assert.match(nav,/router\.refresh\(\)/);
 assert.match(nav,/All Accounts/);
 assert.match(nav,/href:'\/settings'/);
 assert.match(server,/cookies\(\)/);
});
test('the account filter is applied before FIFO matching and to both Trade History queries',()=>{
 const loader=read('src/lib/review/server.ts');
 const trades=read('src/app/trades/page.tsx');
 assert.match(loader,/accountId=active\?\?accountId/);
 assert.match(loader,/e\.brokerage_account_id=\$1::bigint/);
 assert.match(trades,/e\.brokerage_account_id=\$2::bigint/);
 assert.match(trades,/m\.brokerage_account_id=\$2::bigint/);
 assert.match(trades,/COUNT\(\*\)::text AS count/);
 assert.match(trades,/\[symbol\|\|null,account,date\|\|null\]/);
});
test('all top-level reports read the sidebar scope, not independent URL account selections',()=>{
 for(const path of ['src/app/page.tsx','src/app/stats/page.tsx','src/app/calendar/page.tsx',
  'src/app/analytics/page.tsx','src/app/daily/page.tsx','src/app/timing/page.tsx',
  'src/app/insights/page.tsx','src/app/risk/page.tsx','src/app/review/page.tsx','src/app/performance/page.tsx']){
  const code=read(path);
  assert.match(code,/loadReviewLedger\(|activeAccountId\(/,path);
 }
});
test('new trade modal reuses manual validation while account creation belongs to Settings',()=>{
 const modal=read('src/components/new-trade-modal.tsx');
 const editor=read('src/features/manual-trades/editor.tsx');
 const settings=read('src/app/settings/page.tsx');
 const dashboard=read('src/app/page.tsx');
 assert.match(modal,/ManualTradeEditor/);
 assert.match(editor,/saveManualTrade\(form\)/);
 assert.doesNotMatch(editor,/createManualAccount/);
 assert.match(settings,/AccountSettingsForm/);
 assert.match(dashboard,/<NewTradeButton/);
});
