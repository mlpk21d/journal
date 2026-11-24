import test from 'node:test';
import assert from 'node:assert/strict';
import {validCalendarMonth,shiftCalendarMonth,calendarMonthLabel} from '../src/lib/review/calendar-navigation.ts';
import {calendarCells} from '../src/lib/review/daily-performance.ts';
test('previous and next month cross year and February boundaries',()=>{
 assert.equal(shiftCalendarMonth('2026-01',-1),'2025-12');
 assert.equal(shiftCalendarMonth('2026-12',1),'2027-01');
 assert.equal(shiftCalendarMonth('2024-02',1),'2024-03');
 assert.equal(shiftCalendarMonth('2026-11',-12),'2025-11');
 assert.equal(calendarMonthLabel('2026-11'),'November 2026');
});
test('month input is validated independently of the local timezone',()=>{
 assert.equal(validCalendarMonth('2026-02'),true);
 assert.equal(validCalendarMonth('2026-00'),false);
 assert.equal(validCalendarMonth('2026-13'),false);
 assert.throws(()=>shiftCalendarMonth('nope',1),/Invalid/);
 assert.throws(()=>shiftCalendarMonth('2026-01',0.5),/Invalid/);
});
test('shared calendar includes only activity in selected month',()=>{
 const point={date:'2026-11-23',gross:'10',net:'8',fees:'2',accounts:1,closures:1,shares:'2',symbols:['NVDA'],knownNetSubtotal:'8',complete:true};
 const days=[point,{...point,date:'2026-12-01',net:'-5'}];
 const november=calendarCells('2026-11',days).filter(x=>x&&x.closures>0);
 const december=calendarCells('2026-12',days).filter(x=>x&&x.closures>0);
 assert.equal(november.length,1);assert.equal(november[0]?.net,'8');
 assert.equal(december.length,1);assert.equal(december[0]?.net,'-5');
});
