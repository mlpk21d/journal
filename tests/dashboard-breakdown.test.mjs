import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDashboardBreakdown} from '../src/lib/review/dashboard-breakdown.ts';

const fake=(id,direction,net,enteredAt)=>({
 id,accountId:'1',symbol:'XYZ',direction,quantity:'1',entryPrice:'10',
 exitPrice:'11',enteredAt,exitedAt:'2026-11-25T14:30:00.000Z',
 durationMs:0,gross:net??'0',net,fees:net===null?null:'0',
 entryIds:[id+'a'],exitIds:[id+'b'],matchCount:1
});
test('Long and Short breakdown totals, win rates and averages exclude unknown-net trades',()=>{
 const report=buildDashboardBreakdown([
  fake('a','LONG','100','2026-11-23T15:00:00.000Z'),
  fake('b','LONG','-40','2026-11-23T16:00:00.000Z'),
  fake('c','LONG',null,'2026-11-24T15:00:00.000Z'),
  fake('d','LONG','0','2026-11-23T18:00:00.000Z'),
  fake('e','SHORT','50','2026-11-24T16:00:00.000Z'),
  fake('f','SHORT','60','2026-11-22T15:00:00.000Z')
 ]);
 const [long,short]=report.directions;
 assert.equal(long.trades,4);
 assert.equal(long.verified,3);
 assert.equal(long.unverified,1);
 assert.equal(long.net,'60');
 assert.equal(long.wins,1);
 assert.equal(long.losses,1);
 assert.equal(long.averageWin,'100');
 assert.equal(long.averageLoss,'40');
 assert.ok(Math.abs(long.winRate-100/3)<1e-8);
 assert.equal(short.trades,2);
 assert.equal(short.net,'110');
 assert.equal(short.winRate,100);
});
test('Day of Week uses trade entry in Eastern Time and never shows Saturday or Sunday',()=>{
 const report=buildDashboardBreakdown([
  fake('a','LONG','100','2026-11-24T02:30:00.000Z'), // Monday 9:30 PM ET
  fake('b','SHORT','-25','2026-11-24T15:00:00.000Z'),
  fake('c','LONG','30','2026-11-22T15:00:00.000Z'), // Sunday
  fake('d','LONG',null,'2026-11-24T14:30:00.000Z')
 ]);
 assert.deepEqual(report.weekdays.map(row=>row.day),['Mon','Tue','Wed','Thu','Fri']);
 assert.equal(report.weekdays[0].trades,1);
 assert.equal(report.weekdays[0].net,'100');
 assert.equal(report.weekdays[1].trades,2);
 assert.equal(report.weekdays[1].net,'-25');
 assert.equal(report.weekdays[1].verified,1);
 assert.equal(report.weekdays[1].winRate,0);
 assert.equal(report.weekdays[2].trades,0);
 assert.equal(report.weekdays[2].winRate,null);
 assert.equal(report.directions[0].net,'130'); // Weekend counts in Long overall
});
test('empty trades show five weekdays, zero directions, and no fabricated returns',()=>{
 const report=buildDashboardBreakdown([]);
 assert.equal(report.weekdays.length,5);
 for(const row of [...report.weekdays,...report.directions]){
  assert.equal(row.trades,0);
  assert.equal(row.net,'0');
  assert.equal(row.winRate,null);
  assert.equal(row.averageWin,null);
  assert.equal(row.averageLoss,null);
 }
});
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Dashboard has new two panel component and old Top Symbols panel is removed',()=>{
 const dashboard=read('src/app/page.tsx');
 const component=read('src/components/dashboard-breakdown-panels.tsx');
 assert.match(dashboard,/DashboardBreakdownPanels data=\{buildDashboardBreakdown\(trades\)\}/);
 assert.doesNotMatch(dashboard,/Top symbols by known net/);
 assert.match(component,/LONG VS SHORT/);
 assert.match(component,/DAY OF WEEK/);
 assert.match(component,/When you trade/);
 assert.match(component,/sj-breakdown-grid/);
 assert.doesNotMatch(component,/Saturday|Sunday|Sat|Sun/);
});
test('favicon and sidebar branding share the same icon asset',()=>{
 const layout=read('src/app/layout.tsx');
 const nav=read('src/components/navigation.tsx');
 const icon=read('src/app/icon.svg');
 assert.match(layout,/icons:\{icon:'\/icon\.svg'\}/);
 assert.match(nav,/<img src="\/icon\.svg"/);
 assert.match(icon,/<svg/);
});
