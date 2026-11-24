import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Dashboard summary uses computed widths and no longer displays Flat',()=>{
 const page=read('src/app/page.tsx');
 assert.match(page,/dashboardBarScales/);
 assert.match(page,/width={widths\.wins}/);
 assert.match(page,/width={widths\.washSales}/);
 assert.match(page,/label="WASH SALES"/);
 assert.doesNotMatch(page,/label="FLAT"/);
 assert.doesNotMatch(page,/width:'65%'/);
});
test('wash count is scoped to loss account, with all-account replacement screening',()=>{
 const page=read('src/app/page.tsx');
 assert.match(page,/ignoreWorkspaceScope:true/);
 assert.match(page,/screenWashSales\(/);
 assert.match(page,/c\.saleAccountId===selected/);
 assert.match(page,/new Set\(/);
});
test('Tax Imports in Settings is intentionally a future feature, not a file uploader',()=>{
 const page=read('src/app/settings/page.tsx');
 assert.match(page,/Tax Imports/);
 assert.match(page,/Not available yet/);
 assert.doesNotMatch(page,/type="file"/);
});
