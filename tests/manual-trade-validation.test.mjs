import test from 'node:test';
import assert from 'node:assert/strict';
import {validateManualTrade} from '../src/features/manual-trades/validation.ts';
function trade(overrides={}){
 const values={account:'1',symbol:'AMZN',date:'2021-05-05',time:'12:00',
  side:'BUY',entryType:'OPENING',quantity:'10',price:'0',fees:'0',
  notes:'Free stock promotional award',acknowledged:'yes',...overrides};
 const f=new FormData();for(const [key,value] of Object.entries(values))f.set(key,value);
 return f;
}
test('historical opening shares with zero price are valid',()=>{
 const r=validateManualTrade(trade());
 assert.equal(r.price,'0');
 assert.equal(r.timestamp,'2021-05-05T12:00:00.000Z');
});
test('normalizes an optional ticker dollar prefix',()=>{
 assert.equal(validateManualTrade(trade({symbol:'$amzn'})).symbol,'AMZN');
});
test('accepts seconds from HTML time field',()=>{
 assert.equal(validateManualTrade(trade({time:'12:00:00'})).timestamp,'2021-05-05T12:00:00.000Z');
});
test('identifies precisely which input is invalid',()=>{
 assert.throws(()=>validateManualTrade(trade({quantity:'0'})),/Shares:/);
 assert.throws(()=>validateManualTrade(trade({date:''})),/Date:/);
 assert.throws(()=>validateManualTrade(trade({entryType:'OPENING',side:'SELL'})),/Entry type:/);
 assert.throws(()=>validateManualTrade(trade({account:''})),/Brokerage account:/);
});
test('regular sells can be entered manually',()=>{
 assert.equal(validateManualTrade(trade({entryType:'TRADE',side:'SELL'})).side,'SELL');
});
