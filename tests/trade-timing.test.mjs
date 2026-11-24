import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTradeReview} from '../src/lib/review/trade-review.ts';
import {etParts,buildTimingReport} from '../src/lib/review/timing-analytics.ts';
const row=(id,symbol,side,qty,price,time)=>({
 id,accountId:'1',symbol,side,quantity:qty,price,executedAt:time,fees:'0',feeKnown:true
});
test('converts timestamps to Eastern Time across winter, summer and midnight',()=>{
 assert.deepEqual(etParts('2026-01-05T14:30:00Z'),{hour:9,minute:30,weekday:'Monday'});
 assert.deepEqual(etParts('2026-07-06T13:30:00Z'),{hour:9,minute:30,weekday:'Monday'});
 assert.deepEqual(etParts('2026-11-24T01:15:00Z'),{hour:20,minute:15,weekday:'Monday'});
});
test('groups each completed cycle once even with multiple entries and partial exits',()=>{
 const data=[
  row('a','A','BUY','5','10','2026-11-23T14:30:00Z'),
  row('b','A','BUY','5','11','2026-11-23T14:45:00Z'),
  row('c','A','SELL','4','12','2026-11-23T15:15:00Z'),
  row('d','A','SELL','6','13','2026-11-24T15:30:00Z')
 ];
 const result=buildTimingReport(buildTradeReview(data).trades);
 assert.equal(result.total.trades,1);
 assert.equal(result.entryHours.find(x=>x.key==='09')?.metrics.trades,1);
 assert.equal(result.exitHours.find(x=>x.key==='10')?.metrics.trades,1);
 assert.equal(result.entryWeekdays.find(x=>x.key==='Monday')?.metrics.trades,1);
 assert.equal(result.exitWeekdays.find(x=>x.key==='Tuesday')?.metrics.trades,1);
 assert.equal(result.entryHours.reduce((s,x)=>s+x.metrics.trades,0),1);
 assert.equal(result.exitHours.reduce((s,x)=>s+x.metrics.trades,0),1);
});
test('open positions contribute no completed-trade timing statistics',()=>{
 const data=[row('a','B','BUY','10','10','2026-11-23T14:30:00Z'),
  row('b','B','SELL','3','12','2026-11-23T15:30:00Z')];
 const r=buildTimingReport(buildTradeReview(data).trades);
 assert.equal(r.total.trades,0);assert.equal(r.entryHours.length,24);
 assert.ok(r.entryHours.every(x=>x.metrics.trades===0));
});
test('losses and breakevens retain verified statistics by hour',()=>{
 const data=[
  row('a','C','BUY','1','10','2026-11-23T14:00:00Z'),
  row('b','C','SELL','1','9','2026-11-23T14:05:00Z'),
  row('c','D','BUY','1','10','2026-11-23T14:10:00Z'),
  row('d','D','SELL','1','10','2026-11-23T14:15:00Z')
 ];
 const r=buildTimingReport(buildTradeReview(data).trades);
 const bucket=r.entryHours.find(x=>x.key==='09');
 assert.equal(bucket?.metrics.trades,2);
 assert.equal(bucket?.metrics.net,'-1');
 assert.equal(bucket?.metrics.losses,1);
 assert.equal(bucket?.metrics.breakeven,1);
 assert.equal(bucket?.metrics.winRate,0);
});
