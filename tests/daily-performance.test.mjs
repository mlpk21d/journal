import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeDailySessions,calendarCells} from '../src/lib/review/daily-performance.ts';
const session=(date,net,accountId='1',gross=net??'10')=>({
 date,accountId,net,gross,fees:net===null?null:String(Number(gross)-Number(net)),
 closedShares:'2',closureCount:1,symbols:['NVDA']
});
test('aggregates multiple accounts on the same Eastern date exactly once',()=>{
 const report=summarizeDailySessions([session('2026-11-23','4'),session('2026-11-23','-1','2'),
 session('2026-11-24','5')]);
 assert.equal(report.activeDays,2);assert.equal(report.days[0].accounts,2);
 assert.equal(report.days[0].net,'3');assert.equal(report.days[0].closures,2);
 assert.equal(report.netSubtotal,'8');assert.equal(report.wins,2);
 assert.equal(report.longestWinningStreak,2);
});
test('unknown fees do not become fake zero and break consecutive streaks',()=>{
 const report=summarizeDailySessions([
 session('2026-11-19','2'),session('2026-11-20','3'),session('2026-11-23',null),
 session('2026-11-24','-1'),session('2026-11-25','-2'),session('2026-11-26','0'),
 session('2026-11-27','5')
 ]);
 assert.equal(report.unverifiedDays,1);
 assert.equal(report.days[2].net,null);
 assert.equal(report.days[2].knownNetSubtotal,'5');
 assert.equal(report.netSubtotal,'7');
 assert.equal(report.longestWinningStreak,2);
 assert.equal(report.longestLosingStreak,2);
 assert.equal(report.currentWinningStreak,1);
 assert.equal(report.bestDay?.date,'2026-11-27');
 assert.equal(report.worstDay?.date,'2026-11-25');
});
test('one unverified account makes whole day unverified',()=>{
 const report=summarizeDailySessions([session('2026-11-23','3'),session('2026-11-23',null,'2')]);
 assert.equal(report.days[0].net,null);
 assert.equal(report.verifiedDays,0);assert.equal(report.netSubtotal,'0');
});
test('empty result and month calendar use correct Sunday offset and leap days',()=>{
 const report=summarizeDailySessions([]);
 assert.equal(report.activeDays,0);assert.equal(report.bestDay,null);
 const feb=calendarCells('2024-02',[]);
 assert.equal(feb.filter(Boolean).length,29);
 assert.equal(feb[4]?.date,'2024-02-01');
 assert.throws(()=>calendarCells('2024-13',[]),/Invalid/);
});
