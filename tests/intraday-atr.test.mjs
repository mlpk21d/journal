import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateIntradayAtr,easternBarTime,easternClock} from '../src/lib/risk/intraday-atr.ts';
const start=Date.parse('2026-11-25T14:30:00Z');
const bars=Array.from({length:16},(_,i)=>({date:easternClock(start+i*300000),high:101,low:99,close:100}));
test('Eastern timestamp conversion handles summer and winter',()=>{
 assert.equal(easternBarTime('2026-11-25 09:30:00'),start);
 assert.equal(easternBarTime('2026-07-01 09:30:00'),Date.parse('2026-07-01T13:30:00Z'));
});
test('sorts, deduplicates and excludes incomplete bars',()=>{
 const now=start+15*300000;
 const result=calculateIntradayAtr([...bars].reverse().concat(bars[0]),now);
 assert.equal(result.bars,15);assert.ok(Math.abs(result.value-2)<1e-12);assert.equal(result.barClosedAt,now);
 assert.equal(calculateIntradayAtr(bars,start+14*300000),null);
});
test('Wilder smoothing incorporates gaps versus prior close',()=>{
 const data=bars.map(b=>({...b}));
 data[15]={...data[15],high:106,low:104,close:105};
 const result=calculateIntradayAtr(data,start+16*300000);
 assert.ok(Math.abs(result.value-(2*13+6)/14)<1e-12);
});
