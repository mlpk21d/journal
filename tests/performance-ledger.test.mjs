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
 assert.equal(r.unverifiedOpeningSales.length,1);
 assert.equal(r.openPositions.length,2);
 assert.deepEqual(r.openPositions.map(p=>[p.accountId,p.side,p.quantity]),[
  ['A','LONG','10'],['B','SHORT','-10']
 ]);
 // No closing trades were matched; the arithmetic realized subtotal is zero.
 // The opening sell in B remains unverified until broker positions/history reconcile.
 assert.equal(r.net,'0');
});
test('missing fees withhold net, never assume zero',()=>{
 const r=buildLedger([
  row('1','A','ABC','BUY','1','10',null,'2026-11-01T10:00:00Z',false),
  row('2','A','ABC','SELL','1','12','0','2026-11-02T10:00:00Z')
 ]);
 assert.equal(r.gross,'2');assert.equal(r.net,null);assert.equal(r.matches[0].net,null);
});
test('opening sell creates provisional short, not an unmatched sale',()=>{
 const r=buildLedger([row('2','A','ABC','SELL','3','12','0','2026-11-02T10:00:00Z')]);
 assert.equal(r.unverifiedOpeningSales[0].quantity,'3');
 assert.equal(r.openPositions[0].side,'SHORT');
 assert.equal(r.openPositions[0].quantity,'-3');
 assert.equal(r.matches.length,0);
});
test('100 short then 100 buy-to-cover leaves no open shares',()=>{
 const r=buildLedger([
  row('short','A','AMZN','SELL','100','180','1','2026-11-01T10:00:00Z'),
  row('cover','A','AMZN','BUY','100','170','1','2026-11-02T10:00:00Z')
 ]);
 assert.equal(r.openPositions.length,0);
 assert.equal(r.closedShares,'100');
 assert.equal(r.matches[0].direction,'SHORT');
 assert.equal(r.matches[0].gross,'1000');
 assert.equal(r.net,'998');
 assert.equal(r.unverifiedOpeningSales.length,1);
});
test('partially covering short leaves negative signed shares',()=>{
 const r=buildLedger([
  row('short','A','AMZN','SELL','100','180','1','2026-11-01T10:00:00Z'),
  row('cover','A','AMZN','BUY','40','170','0.4','2026-11-02T10:00:00Z')
 ]);
 assert.equal(r.openPositions[0].quantity,'-60');
 assert.equal(r.openPositions[0].side,'SHORT');
 assert.equal(r.gross,'400');
 assert.equal(r.matches[0].net,'399.2');
});
test('buy larger than short covers it and opens new long inventory',()=>{
 const r=buildLedger([
  row('short','A','AMZN','SELL','100','180','1','2026-11-01T10:00:00Z'),
  row('buy','A','AMZN','BUY','125','170','1.25','2026-11-02T10:00:00Z')
 ]);
 assert.equal(r.closedShares,'100');
 assert.equal(r.openPositions[0].quantity,'25');
 assert.equal(r.openPositions[0].side,'LONG');
 assert.equal(r.matches[0].net,'998');
});
test('sell larger than long position closes long and opens residual short',()=>{
 const r=buildLedger([
  row('buy','A','AMZN','BUY','40','100','0.4','2026-11-01T10:00:00Z'),
  row('sell','A','AMZN','SELL','100','110','1','2026-11-02T10:00:00Z')
 ]);
 assert.equal(r.matches[0].direction,'LONG');
 assert.equal(r.gross,'400');
 assert.equal(r.openPositions[0].quantity,'-60');
 assert.equal(r.unverifiedOpeningSales[0].quantity,'60');
});
test('matched short is isolated between accounts',()=>{
 const r=buildLedger([
  row('short','A','AMZN','SELL','100','180','0','2026-11-01T10:00:00Z'),
  row('buy','B','AMZN','BUY','100','170','0','2026-11-02T10:00:00Z')
 ]);
 assert.equal(r.matches.length,0);
 assert.equal(r.openPositions.find(p=>p.accountId==='A').quantity,'-100');
 assert.equal(r.openPositions.find(p=>p.accountId==='B').quantity,'100');
});
