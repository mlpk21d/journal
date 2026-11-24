import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTickerPnlReport,exitDateET} from '../src/lib/review/ticker-pnl.ts';
const r=(id,accountId,symbol,side,qty,price,at,fees='0',feeKnown=true)=>({
 id,accountId,symbol,side,quantity:qty,price,executedAt:at,fees,feeKnown
});
const at=(d,min='00')=>'2026-11-'+d+'T14:'+min+':00.000Z';
test('ticker net includes partial exits even when position remains open',()=>{
 const data=[r('a','1','NVDA','BUY','10','100',at('20')),
  r('b','1','NVDA','SELL','4','110',at('21'))];
 const report=buildTickerPnlReport(data);
 const row=report.rows[0];
 assert.equal(row.symbol,'NVDA');
 assert.equal(row.knownNet,'40');
 assert.equal(row.realizedGross,'40');
 assert.equal(row.fifoClosures,1);
 assert.equal(row.completedTrades,0);
 assert.equal(row.openQuantity,'6');
 assert.equal(report.knownNet,'40');
});
test('two accounts remain isolated and multiple symbols do not mix',()=>{
 const data=[r('a','1','NVDA','BUY','1','100',at('20')),
  r('b','1','NVDA','SELL','1','110',at('21')),
  r('c','2','NVDA','BUY','2','50',at('20','01')),
  r('d','2','NVDA','SELL','2','45',at('22')),
  r('e','1','AMD','BUY','1','10',at('20','02')),
  r('f','1','AMD','SELL','1','13',at('22','03'))];
 const report=buildTickerPnlReport(data);
 const nvda=report.rows.find(x=>x.symbol==='NVDA');
 assert.equal(nvda.accounts,2);
 assert.equal(nvda.knownNet,'0');
 assert.equal(nvda.completedTrades,2);
 assert.equal(nvda.winRate,50);
 assert.equal(report.rows.find(x=>x.symbol==='AMD').knownNet,'3');
 assert.equal(report.knownNet,'3');
});
test('unverified fees never silently become zero in ticker totals',()=>{
 const data=[r('a','1','NVDA','BUY','1','10',at('20')),
  r('b','1','NVDA','SELL','1','12',at('21')),
  r('c','1','NVDA','BUY','1','10',at('22'),null,false),
  r('d','1','NVDA','SELL','1','20',at('23'))];
 const row=buildTickerPnlReport(data).rows[0];
 assert.equal(row.knownNet,'2');
 assert.equal(row.realizedGross,'12');
 assert.equal(row.fullyVerified,false);
 assert.equal(row.unverifiedClosures,1);
 assert.equal(row.knownFees,'0');
 assert.equal(row.verifiedCompleted,1);
});
test('exit date filter applies after reconstructing historical FIFO lots',()=>{
 const data=[r('a','1','NVDA','BUY','10','10',at('20')),
  r('b','1','NVDA','SELL','5','12',at('21')),
  r('c','1','NVDA','SELL','5','13',at('22'))];
 const report=buildTickerPnlReport(data,{from:'2026-11-22',to:'2026-11-22'});
 assert.equal(report.rows[0].knownNet,'15');
 assert.equal(report.rows[0].completedTrades,1);
 assert.equal(report.rows[0].fifoClosures,1);
});
test('exchange time date handles midnight UTC rollover and daylight saving',()=>{
 assert.equal(exitDateET('2026-11-24T01:00:00.000Z'),'2026-11-23');
 assert.equal(exitDateET('2026-07-06T02:00:00.000Z'),'2026-07-05');
});
test('symbols with only open inventory are visible but no realized result is invented',()=>{
 const report=buildTickerPnlReport([r('a','1','PLTR','BUY','3','25',at('20'))]);
 assert.equal(report.rows[0].symbol,'PLTR');
 assert.equal(report.rows[0].fifoClosures,0);
 assert.equal(report.rows[0].knownNet,'0');
 assert.equal(report.rows[0].openQuantity,'3');
});
