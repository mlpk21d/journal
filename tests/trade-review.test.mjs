import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTradeReview} from '../src/lib/review/trade-review.ts';
import {buildLedger,parseFixed} from '../src/lib/performance/ledger.ts';
const row=(id,accountId,symbol,side,quantity,price,fees,executedAt)=>({id,accountId,symbol,side,quantity,price,fees,feeKnown:true,executedAt});
const at=(h)=>'2026-11-23T'+h+':00.000Z';
test('multi-entry partial exits are one flat-to-flat trade, preserving FIFO amounts',()=>{
 const data=[row('a','1','NVDA','BUY','10','100','1',at('14:00')),
 row('b','1','NVDA','BUY','10','110','1',at('14:05')),
 row('c','1','NVDA','SELL','5','120','0.5',at('14:10')),
 row('d','1','NVDA','SELL','15','130','1.5',at('14:20'))];
 const v=buildTradeReview(data),ledger=buildLedger(data);
 assert.equal(v.trades.length,1);assert.equal(v.trades[0].quantity,'20');
 assert.equal(v.trades[0].entryPrice,'105');assert.equal(v.trades[0].exitPrice,'127.5');
 assert.equal(v.trades[0].gross,ledger.gross);assert.equal(v.trades[0].net,ledger.net);
 assert.equal(v.trades[0].fees,'4');assert.equal(v.sessions.length,1);
});
test('partial exits appear in sessions without a falsely completed trade',()=>{
 const v=buildTradeReview([row('a','1','A','BUY','10','10','0',at('14:00')),row('b','1','A','SELL','2','12','0',at('14:10'))]);
 assert.equal(v.trades.length,0);assert.equal(v.sessions[0].gross,'4');
 assert.equal(v.openPositions[0].quantity,'8');
});
test('short entries and covers become one closed trade',()=>{
 const v=buildTradeReview([row('a','1','S','SELL','3','20','0',at('14:00')),row('b','1','S','SELL','2','22','0',at('14:01')),row('c','1','S','BUY','5','19','0',at('14:15'))]);
 assert.equal(v.trades[0].direction,'SHORT');assert.equal(v.trades[0].quantity,'5');
 assert.equal(v.trades[0].gross,'9');assert.equal(v.trades[0].net,'9');
});
test('reversal ends one trade and starts another without counting rollover shares as closed',()=>{
 const v=buildTradeReview([row('a','1','R','BUY','5','10','0',at('14:00')),row('b','1','R','SELL','8','12','0',at('14:05')),row('c','1','R','BUY','3','11','0',at('14:10'))]);
 assert.equal(v.trades.length,2);
 assert.deepEqual(v.trades.map(t=>[t.direction,t.quantity,t.gross]),[['SHORT','3','3'],['LONG','5','10']]);
});
test('accounts are isolated and session dates are Eastern not UTC',()=>{
 const v=buildTradeReview([row('a','1','X','BUY','1','10','0','2026-11-23T23:30:00Z'),
 row('b','1','X','SELL','1','11','0','2026-11-24T00:30:00Z'),
 row('c','2','X','SELL','1','20','0','2026-11-24T00:31:00Z'),
 row('d','2','X','BUY','1','18','0','2026-11-24T01:00:00Z')]);
 assert.equal(v.trades.length,2);assert.equal(v.sessions.length,2);
 assert.ok(v.sessions.every(s=>s.date==='2026-11-23'));
});
test('no mutation of source rows; fractional quantities and same-price closes',()=>{
 const data=Object.freeze([Object.freeze(row('a','1','F','BUY','0.5','10','0.01',at('14:00'))),
 Object.freeze(row('b','1','F','SELL','0.5','10','0.02',at('14:01')))]);
 const v=buildTradeReview(data);
 assert.equal(v.trades[0].quantity,'0.5');assert.equal(v.trades[0].net,'-0.03');
 assert.equal(parseFixed(v.trades[0].fees),3000000n);
});
