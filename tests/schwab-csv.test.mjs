import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSchwabCsv} from '../src/lib/schwab/csv.ts';
const head='Date,Action,Symbol,Description,Quantity,Price,Fees & Comm,Amount';
const csv=(lines)=>[head,...lines].join('\n')+'\n';
test('Schwab CSV keeps original intraday trade sequence oldest to newest with estimated 9:30 ET seconds',()=>{
 const p=parseSchwabCsv(csv([
  '11/19/2026,Buy,PLTR,Palantir,25,$160.80,,-$4020.00',
  '11/19/2026,Sell Short,PLTR,Palantir,25,$159.7051,$0.08,$3992.55',
  '11/19/2026,Sell,PLTR,Palantir,25,$159.6788,$0.08,$3991.89',
  '11/19/2026,Buy,PLTR,Palantir,25,$160.53,,-$4013.25'
 ]));
 assert.equal(p.trades,4);
 const trades=p.rows.filter(x=>x.kind==='trade');
 assert.deepEqual(trades.map(x=>x.side),['BUY','SELL','SELL','BUY']);
 assert.deepEqual(trades.map(x=>x.action),['Buy','Sell','Sell Short','Buy']);
 assert.deepEqual(trades.map(x=>x.timestamp),[
  '2026-11-19T14:30:00.000Z','2026-11-19T14:30:01.000Z',
  '2026-11-19T14:30:02.000Z','2026-11-19T14:30:03.000Z'
 ]);
 assert.equal(trades[1].fees,'0.08');
});
test('Wire Sent rows excluded and Service Fee imported independently of trade commissions',()=>{
 const p=parseSchwabCsv(csv([
  '11/19/2026,Wire Sent,,WIRED FUNDS DISBURSED,,,,-$20463.67',
  '11/19/2026,Service Fee,,WIRED FUNDS FEE,,,,-$15.00',
  '11/19/2026,Buy,PLTR,Palantir,25,$160.80,,-$4020.00',
  '11/19/2026,Sell,PLTR,Palantir,25,$159.68,$0.08,$3992.00',
  '11/18/2026,Credit Interest,,Interest,,,,$0.30',
  '11/18/2026,MoneyLink Transfer,,Transfer,,,,$300.00'
 ]));
 assert.equal(p.wireSent,1);assert.equal(p.ignored,2);
 assert.equal(p.trades,2);assert.equal(p.fees,1);
 const fee=p.rows.find(x=>x.kind==='fee');
 assert.equal(fee.amount,'15');
 assert.equal(p.rows.filter(x=>x.kind==='trade')[0].fees,'0.08');
});
test('same CSV produces identical fingerprints; repeated identical rows remain individually identifiable',()=>{
 const contents=csv([
  '11/19/2026,Buy,NVDA,NVIDIA,1,$100,,-$100',
  '11/19/2026,Buy,NVDA,NVIDIA,1,$100,,-$100'
 ]);
 const a=parseSchwabCsv(contents),b=parseSchwabCsv(contents);
 assert.equal(a.rows.length,2);
 assert.notEqual(a.rows[0].key,a.rows[1].key);
 assert.deepEqual(a.rows.map(x=>x.key),b.rows.map(x=>x.key));
});
test('daylight-saving Eastern market morning uses correct UTC offset',()=>{
 const p=parseSchwabCsv(csv([
  '07/06/2026,Buy,NVDA,NVIDIA,2,$100,,-$200',
  '01/12/2026,Buy,NVDA,NVIDIA,1,$100,,-$100'
 ]));
 assert.equal(p.rows[0].kind,'trade');
 assert.equal(p.rows[0].timestamp,'2026-01-12T14:30:00.000Z');
 assert.equal(p.rows[1].timestamp,'2026-07-06T13:30:00.000Z');
});
test('malformed amounts, invalid dates and unsupported CSV columns fail safely',()=>{
 assert.throws(()=>parseSchwabCsv('invalid,header\nhello,world'),/Expected a Charles Schwab/);
 assert.throws(()=>parseSchwabCsv(csv(['02/30/2026,Buy,NVDA,NVIDIA,1,$100,,-$100'])),/Invalid trade/);
 assert.throws(()=>parseSchwabCsv(csv(['11/19/2026,Buy,NVDA,NVIDIA,-1,$100,,-$100'])),/Invalid shares/);
 assert.throws(()=>parseSchwabCsv(csv(['11/19/2026,Service Fee,,Fee,,,,$15.00'])),/Expected a negative service fee/);
});
test('quoted descriptions parse, no private identifiers are required',()=>{
 const p=parseSchwabCsv(csv(['11/19/2026,Buy,NVDA,"NVIDIA, INC",1,$100,,-$100']));
 assert.equal(p.rows[0].description,'NVIDIA, INC');
});
