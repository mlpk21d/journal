import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Schwab import confirms selected account, atomically saves and deduplicates',()=>{
 const s=read('src/features/schwab-import/actions.ts');
 assert.match(s,/broker IN \('schwab','manual'\)/);
 assert.match(s,/form\.get\('confirm'\)/);
 assert.match(s,/await conn\.query\('BEGIN'\)/);
 assert.match(s,/await conn\.query\('COMMIT'\)/);
 assert.match(s,/await conn\.query\('ROLLBACK'\)/);
 assert.match(s,/ON CONFLICT \(brokerage_account_id,broker_execution_id\) DO NOTHING/);
 assert.match(s,/source,broker_execution_id/);
 assert.match(s,/SCHWAB_COMMISSION/);
 assert.match(s,/source,source_key/);
});
test('import page and Fees route available via navigation and index',()=>{
 const nav=read('src/components/navigation.tsx'),index=read('README.md');
 assert.match(nav,/href:'\/import\/schwab'/);
 assert.match(nav,/href:'\/fees'/);
 assert.match(index,/\/import\/schwab/);
 assert.match(index,/\/fees/);
 assert.match(read('src/app/import/schwab/page.tsx'),/SchwabCsvForm/);
 assert.match(read('src/app/fees/page.tsx'),/AccountFees/);
});
test('Schwab executions are included in existing ledger and Review while account-level fees stay separate',()=>{
 for(const p of ['src/lib/review/server.ts','src/app/review/page.tsx','src/app/performance/page.tsx'])
  assert.match(read(p),/schwab_csv/,p);
 const feePage=read('src/app/fees/page.tsx');
 assert.match(feePage,/FROM account_fees/);
 assert.match(feePage,/not subtracted again from FIFO trade/);
});
test('Schwab account creation is an explicit choice in Settings',()=>{
 assert.match(read('src/components/account-settings-form.tsx'),/Charles Schwab \(CSV import\)/);
 assert.match(read('src/features/manual-trades/actions.ts'),/broker==='schwab'/);
});
