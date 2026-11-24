import test from 'node:test';
import assert from 'node:assert/strict';
import {screenWashSales} from '../src/lib/review/wash-sales.ts';

const date=(day,hour=15)=>'2026-01-'+String(day).padStart(2,'0')+'T'+String(hour).padStart(2,'0')+':00:00.000Z';
const row=(id,accountId,side,quantity,price,executedAt,symbol='NVDA')=>({
 id,accountId,symbol,side,quantity,price,executedAt,fees:'0',feeKnown:true
});
const accounts=[{id:'1',label:'Taxable 1',type:'Individual'}, {id:'2',label:'Taxable 2',type:'Individual'},
 {id:'3',label:'IRA',type:'Roth IRA'}];
test('same-account post-sale repurchase flags proportional loss shares and amount',()=>{
 const records=[
  row('b1','1','BUY','100','10',date(2)),
  row('s1','1','SELL','100','8',date(10)),
  row('b2','1','BUY','40','9',date(11))
 ];
 const result=screenWashSales(records,accounts,'2026-03-01');
 assert.equal(result.candidates.length,1);
 assert.equal(result.candidates[0].matchedShares,'40');
 assert.equal(result.candidates[0].estimatedDisallowed,'80');
 assert.equal(result.potentialDisallowed,'80');
 assert.equal(result.candidates[0].daysFromSale,1);
});
test('prior purchases sold by the loss sale are not eligible replacement shares',()=>{
 const records=[row('b1','1','BUY','100','10',date(1)),row('s1','1','SELL','100','8',date(2))];
 assert.equal(screenWashSales(records,accounts,'2026-03-01').candidates.length,0);
});
test('prior purchases still held after sale can be matched',()=>{
 const records=[
  row('b1','1','BUY','100','10',date(1)),
  row('b2','1','BUY','100','9',date(2)),
  row('s1','1','SELL','100','8',date(3))
 ];
 const result=screenWashSales(records,accounts,'2026-03-01');
 assert.equal(result.candidates.length,1);
 assert.equal(result.candidates[0].purchaseId,'b2');
 assert.equal(result.candidates[0].daysFromSale,-1);
 assert.equal(result.candidates[0].estimatedDisallowed,'200');
});
test('cross-account replacement purchase is reported and retirement account flagged',()=>{
 const records=[row('b1','1','BUY','20','10',date(2)),row('s1','1','SELL','20','8',date(10)),
  row('b2','3','BUY','20','9',date(11))];
 const r=screenWashSales(records,accounts,'2026-03-01');
 assert.equal(r.crossAccountCount,1);
 assert.equal(r.retirementCount,1);
 assert.equal(r.candidates[0].estimatedDisallowed,'40');
});
test('partial replacement shares cannot be reused across multiple loss dispositions',()=>{
 const rows=[
  row('b1','1','BUY','10','10',date(1)),
  row('b3','1','BUY','10','10',date(2)),
  row('s1','1','SELL','20','8',date(8)),
  row('b2','2','BUY','12','9',date(10))
 ];
 const r=screenWashSales(rows,accounts,'2026-03-01');
 assert.equal(r.candidates.reduce((n,c)=>n+Number(c.matchedShares),0),12);
 assert.equal(r.potentialDisallowed,'24');
});
test('future monitoring, outside-window buys, and no modifications to original history',()=>{
 const rows=[row('b1','1','BUY','10','10',date(1)),row('s1','1','SELL','10','8',date(3)),
  row('b2','1','BUY','5','8','2026-02-05T15:00:00.000Z')];
 const saved=structuredClone(rows);
 const r=screenWashSales(rows,accounts,'2026-01-15');
 assert.equal(r.candidates.length,0);
 assert.equal(r.reviewedLongLossMatches,1);
 assert.deepEqual(rows,saved);
});
test('short-loss cases are explicitly excluded pending specialized short-sale rules',()=>{
 const rows=[row('s1','1','SELL','10','10',date(1)),row('b1','1','BUY','10','12',date(2)),
  row('b2','1','BUY','10','11',date(3))];
 const r=screenWashSales(rows,accounts,'2026-03-01');
 assert.equal(r.shortLossMatches,1);
 assert.equal(r.candidates.length,0);
});

test('30-day boundary is inclusive and 31-day purchases are not flagged',()=>{
 const purchase='2026-02-01T15:00:00.000Z';
 const start=[
  row('b1','1','BUY','20','10','2026-01-01T15:00:00.000Z'),
  row('s1','1','SELL','20','8','2026-01-02T15:00:00.000Z')
 ];
 const plus30=screenWashSales([...start,row('b2','1','BUY','10','9',purchase)],accounts,'2026-03-15');
 assert.equal(plus30.candidates.length,1);
 assert.equal(plus30.candidates[0].daysFromSale,30);
 const plus31=screenWashSales([...start,row('b2','1','BUY','10','9','2026-02-02T15:00:00.000Z')],accounts,'2026-03-15');
 assert.equal(plus31.candidates.length,0);
});
test('an unresolved 30-day loss window is counted even before a replacement buy',()=>{
 const records=[row('b1','1','BUY','10','10',date(1)),row('s1','1','SELL','10','8',date(10))];
 const r=screenWashSales(records,accounts,'2026-01-15');
 assert.equal(r.openWindowLosses,1);
 assert.equal(r.candidates.length,0);
});
