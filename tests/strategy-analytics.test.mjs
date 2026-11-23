import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTradeReview} from '../src/lib/review/trade-review.ts';
import {tradeFingerprint} from '../src/lib/review/identity.ts';
import {buildAnalytics,calculateMetrics,summarizeAnalytics} from '../src/lib/review/analytics.ts';
const at=(i)=>'2026-11-23T14:'+String(i).padStart(2,'0')+':00.000Z';
const row=(id,symbol,side,price,i,fees='0')=>({id,accountId:'1',symbol,side,quantity:'1',price,fees,feeKnown:true,executedAt:at(i)});
const rows=[
 row('a','A','BUY','10',0),row('b','A','SELL','20',1),
 row('c','B','SELL','30',2),row('d','B','BUY','25',3),
 row('e','C','BUY','10',4),row('f','C','SELL','15',5),
 row('g','D','BUY','10',6),row('h','D','SELL','10',7)
];
test('metrics count wins, losses, flat and verified values without rounding source cents',()=>{
 const items=[
 {trade:{net:'10.00'},status:'verified'},
 {trade:{net:'-5.00'},status:'verified'},
 {trade:{net:'0'},status:'verified'},
 {trade:{net:null},status:'missing'}
 ];
 const m=calculateMetrics(items);
 assert.equal(m.trades,4);assert.equal(m.verified,3);assert.equal(m.unverified,1);
 assert.equal(m.wins,1);assert.equal(m.losses,1);assert.equal(m.breakeven,1);
 assert.equal(m.net,'5');assert.equal(m.average,'1.66666666');
 assert.ok(Math.abs(m.winRate-100/3)<1e-10,'win rate should be approximately one third');
 assert.equal(m.profitFactor,2);
});
test('profit factor handles no losses, no wins, and missing net',()=>{
 const mk=(net)=>({trade:{net}});
 assert.equal(calculateMetrics([mk('7')]).profitFactor,'∞');
 assert.equal(calculateMetrics([mk('-2')]).profitFactor,0);
 assert.equal(calculateMetrics([mk('0'),mk(null)]).profitFactor,null);
 assert.equal(calculateMetrics([mk(null)]).winRate,null);
});
test('verified notes group by strategy; stale and missing notes remain separate',()=>{
 const trades=buildTradeReview(rows).trades;
 const a=trades.find(t=>t.symbol==='A');
 const b=trades.find(t=>t.symbol==='B');
 const c=trades.find(t=>t.symbol==='C');
 const notes=[
 {cycleKey:a.id,fingerprint:tradeFingerprint(a,rows),strategy:'ORB',mistakes:'Chased'},
 {cycleKey:b.id,fingerprint:tradeFingerprint(b,rows),strategy:'ORB',mistakes:''},
 {cycleKey:c.id,fingerprint:'0'.repeat(64),strategy:'ORB',mistakes:'Bad stop'}
 ];
 const report=buildAnalytics(trades,rows,notes);
 assert.equal(report.annotated,2);assert.equal(report.stale,1);assert.equal(report.unreviewed,1);
 assert.equal(report.byStrategy.find(x=>x.label==='ORB').metrics.trades,2);
 assert.equal(report.byStrategy.find(x=>x.label==='Changed history').metrics.trades,1);
 assert.equal(report.byStrategy.find(x=>x.label==='Unreviewed').metrics.trades,1);
 assert.equal(report.byMistake.find(x=>x.label==='Recorded').metrics.trades,1);
 assert.equal(report.byDirection.find(x=>x.label==='SHORT').metrics.trades,1);
 const filtered=summarizeAnalytics(report.trades.filter(t=>t.strategy==='ORB'));
 assert.equal(filtered.overall.trades,2);
 assert.equal(filtered.overall.net,'15');
});
