import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLedger,parseFixed,formatFixed} from '../src/lib/performance/ledger.ts';
const row=(id,accountId,symbol,side,quantity,price,fees,when,feeKnown=true)=>({
 id,accountId,symbol,side,quantity,price,fees,feeKnown,executedAt:when
});
test('fixed decimal money preserves fractional cents',()=>{
 assert.equal(formatFixed(parseFixed('123.12345678')),'123.12345678');
 assert.equal(formatFixed(parseFixed('-0.01000000')),'-0.01');
});
test('full round trip computes gross and net after entry and exit fees',()=>{
 const data=[
  row('1','A','NVDA','BUY','100','10','1','2026-11-01T10:00:00Z'),
  row('2','A','NVDA','SELL','100','12','2','2026-11-02T10:00:00Z')
 ];
 const r=buildLedger(data);
 assert.equal(r.gross,'200'); assert.equal(r.net,'197');
 assert.equal(r.matches.length,1);assert.equal(r.closedShares,'100');
});
test('FIFO matches multiple lots and allocates fees without duplication',()=>{
 const data=[
  row('1','A','NVDA','BUY','2','10','0.02','2026-11-01T10:00:00Z'),
  row('2','A','NVDA','BUY','2','15','0.02','2026-11-01T11:00:00Z'),
  row('3','A','NVDA','SELL','3','20','0.03','2026-11-02T11:00:00Z')
 ];
 const r=buildLedger(data);
 assert.equal(r.gross,'25');assert.equal(r.net,'24.94');
 assert.deepEqual(r.matches.map(x=>x.quantity),['2','1']);
 assert.equal(r.openPositions[0].quantity,'1');
});
test('does not match one brokerage account against another',()=>{
 const r=buildLedger([
  row('1','A','NVDA','BUY','10','10','0','2026-11-01T10:00:00Z'),
  row('2','B','NVDA','SELL','10','12','0','2026-11-02T10:00:00Z')
 ]);
 assert.equal(r.matches.length,0);
 assert.equal(r.unmatchedSales.length,1);
 assert.equal(r.openPositions.length,1);
 assert.equal(r.net,null);
});
test('missing fees withhold net, never assume zero',()=>{
 const r=buildLedger([
  row('1','A','ABC','BUY','1','10',null,'2026-11-01T10:00:00Z',false),
  row('2','A','ABC','SELL','1','12','0','2026-11-02T10:00:00Z')
 ]);
 assert.equal(r.gross,'2');assert.equal(r.net,null);assert.equal(r.matches[0].net,null);
});
test('missing initial buy history flags unmatched sale',()=>{
 const r=buildLedger([row('2','A','ABC','SELL','3','12','0','2026-11-02T10:00:00Z')]);
 assert.equal(r.unmatchedSales[0].quantity,'3');assert.equal(r.net,null);
});
