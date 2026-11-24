import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('header positions Import Today between search and New Trade',()=>{
 const nav=read('src/components/navigation.tsx');
 const search=nav.indexOf('<form className="sj-topbar-search"');
 const importer=nav.indexOf('<ImportTodayButton accounts={accounts} selected={selected}/>');
 const trade=nav.indexOf('<button className="sj-topbar-quick"');
 assert.ok(search>=0&&importer>search&&trade>importer);
});
test('Import Today checks selected cached Webull brokerage account on the server',()=>{
 const action=read('src/app/import/actions.ts');
 assert.match(action,/export async function importTodayForSelectedAccount/);
 assert.match(action,/await assertLocalBrowser\(\)/);
 assert.match(action,/const selected=await activeAccountId\(\)/);
 assert.match(action,/account\.broker!=='webull'/);
 assert.match(action,/available\.find\(a=>a\.id===account\.external_account_id\)/);
 assert.match(action,/todayEasternRange\(\)/);
 assert.match(action,/importWebullOrders\(found\.id,start,end\)/);
 assert.doesNotMatch(action.slice(action.indexOf('export async function importTodayForSelectedAccount')),/accountId==='__all__'/);
});
test('importer counts new snapshots separately from existing snapshots updated',()=>{
 const importer=read('src/lib/webull/import.ts');
 assert.match(importer,/newExecutions:number/);
 assert.match(importer,/const existed=/);
 assert.match(importer,/if\(!existed\)newExecutions\+\+/);
 const action=read('src/app/import/actions.ts');
 assert.match(action,/newTrades:response\.newExecutions/);
 assert.match(action,/updatedTrades:response\.savedExecutions-response\.newExecutions/);
});
test('overlay blocks page during loading, result dialog reports new and updated counts',()=>{
 const component=read('src/components/import-today-button.tsx');
 assert.match(component,/selectedAccount\?\.broker==='webull'/);
 assert.match(component,/disabled=\{!allowed\|\|pending\}/);
 assert.match(component,/role="alertdialog"/);
 assert.match(component,/role="dialog"/);
 assert.match(component,/result\.newTrades/);
 assert.match(component,/result\.updatedTrades/);
 assert.match(component,/router\.refresh\(\)/);
});
