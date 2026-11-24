import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('import scans paginated Webull history before reporting a determinate total',()=>{
 const importer=read('src/lib/webull/import.ts');
 assert.match(importer,/const history:Obj\[\]=\[\]/);
 assert.match(importer,/history\.push\(\.\.\.result\.orders\)/);
 assert.match(importer,/stage:'scanning'/);
 assert.match(importer,/stage:'ready',total,previouslyImported/);
 assert.ok(importer.indexOf("stage:'ready',total")<importer.indexOf('for(const item of history)'));
});
test('database snapshot inventory is checked before writing new import records',()=>{
 const importer=read('src/lib/webull/import.ts');
 assert.match(importer,/JOIN executions e ON e\.brokerage_order_id=o\.id/);
 assert.match(importer,/o\.brokerage_account_id=\$1/);
 assert.match(importer,/originallyKnown\.has\(order\.brokerOrderId\)/);
 assert.match(importer,/previouslyImported:originallyKnown\.has\(order\.brokerOrderId\)/);
});
test('per-order progress only follows COMMIT with new versus existing status',()=>{
 const importer=read('src/lib/webull/import.ts');
 assert.match(importer,/snapshotStatus=existed\?'updated':'new'/);
 assert.match(importer,/if\(!existed\)newExecutions\+\+/);
 assert.ok(importer.indexOf("await conn.query('COMMIT');")<importer.indexOf("status:snapshotStatus,previouslyImported:"));
 assert.match(importer,/status:'skipped'/);
 assert.match(importer,/onProgress\?\.\(\{stage:'complete',summary\}\)/);
});
test('stream route resolves sidebar cookie and rejects manual or all-account imports',()=>{
 const route=read('src/app/api/webull/import-today/route.ts');
 assert.match(route,/request\.cookies\.get\(ACCOUNT_COOKIE\)/);
 assert.match(route,/account\.broker!=='webull'/);
 assert.match(route,/cached\.find\(a=>a\.id===account\.external_account_id\)/);
 assert.match(route,/localRequest\(request\)/);
 assert.match(route,/const \{date,start,end\}=todayEasternRange\(\)/);
 assert.match(route,/importWebullOrders\(found\.id,start,end,send\)/);
 assert.match(route,/application\/x-ndjson/);
});
test('header progress UI streams to console including previously imported and skipped',()=>{
 const button=read('src/components/import-today-button.tsx');
 assert.match(button,/fetch\('\/api\/webull\/import-today'/);
 assert.match(button,/response\.body\.getReader\(\)/);
 assert.match(button,/console\.info\('\[Trade Journal\] Imported order'/);
 assert.match(button,/alreadyImported:event\.previouslyImported/);
 assert.match(button,/status:'new'\|'updated'\|'skipped'/);
 assert.match(button,/role="progressbar"/);
 assert.match(button,/progress\.previouslyImported/);
 assert.match(button,/result\.newTrades/);
 assert.match(button,/result\.updatedTrades/);
 assert.match(button,/router\.refresh\(\)/);
});
