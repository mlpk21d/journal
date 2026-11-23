import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWebullOrderFee} from '../src/lib/performance/fee-policy.ts';
import {buildLedger} from '../src/lib/performance/ledger.ts';

test('missing Webull fee rows become known zero-dollar fees',()=>{
 assert.deepEqual(normalizeWebullOrderFee(null),{fees:'0',feeKnown:true});
});
test('explicit broker fees are not replaced',()=>{
 assert.deepEqual(normalizeWebullOrderFee('0.39000000'),{fees:'0.39000000',feeKnown:true});
});
test('missing BUY fee records no longer withhold net P&L',()=>{
 const buy=normalizeWebullOrderFee(null);
 const sell=normalizeWebullOrderFee('0.39');
 const r=buildLedger([
  {id:'buy',accountId:'A',symbol:'NVDA',side:'BUY',quantity:'110',price:'168.29',executedAt:'2026-11-23T15:57:00Z',...buy},
  {id:'sell',accountId:'A',symbol:'NVDA',side:'SELL',quantity:'110',price:'168.54',executedAt:'2026-11-23T15:58:00Z',...sell}
 ]);
 assert.equal(r.gross,'27.5');
 assert.equal(r.net,'27.11');
 assert.equal(r.netKnown,true);
});
