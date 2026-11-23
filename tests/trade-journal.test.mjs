import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTradeReview} from '../src/lib/review/trade-review.ts';
import {tradeFingerprint,validateJournalDraft} from '../src/lib/review/identity.ts';
const row=(id,side,quantity,price,fees='0')=>({id,accountId:'1',symbol:'NVDA',side,quantity,price,fees,feeKnown:true,executedAt:id==='a'?'2026-11-23T14:00:00Z':'2026-11-23T14:05:00Z'});
const draft=(overrides={})=>({strategy:'ORB',setup:'Compression',entryReason:'Breakout',exitReason:'Target',mistakes:'',lessons:'Follow the plan',screenshotUrl:'',...overrides});
test('trade fingerprint is deterministic for the same ordered executions',()=>{
 const rows=[row('a','BUY','10','10'),row('b','SELL','10','12')],trade=buildTradeReview(rows).trades[0];
 assert.equal(tradeFingerprint(trade,rows),tradeFingerprint(trade,[...rows].reverse()));
 assert.match(tradeFingerprint(trade,rows),/^[a-f0-9]{64}$/);
});
test('fingerprint changes with execution fee or price changes',()=>{
 const rows=[row('a','BUY','10','10'),row('b','SELL','10','12')],trade=buildTradeReview(rows).trades[0];
 const fingerprint=tradeFingerprint(trade,rows);
 assert.notEqual(fingerprint,tradeFingerprint(trade,[rows[0],{...rows[1],fees:'0.01'}]));
 assert.notEqual(fingerprint,tradeFingerprint(trade,[rows[0],{...rows[1],price:'13'}]));
});
test('rejects missing executions when constructing a fingerprint',()=>{
 const rows=[row('a','BUY','10','10'),row('b','SELL','10','12')],trade=buildTradeReview(rows).trades[0];
 assert.throws(()=>tradeFingerprint(trade,[rows[0]]),/Incomplete/);
});
test('validates journal fields and screenshot references',()=>{
 assert.equal(validateJournalDraft(draft()).strategy,'ORB');
 assert.throws(()=>validateJournalDraft(draft({screenshotUrl:'http://example.com/photo'})),/HTTPS/);
 assert.throws(()=>validateJournalDraft(draft({screenshotUrl:'https://alice:pass@example.com/image'})),/HTTPS/);
 assert.throws(()=>validateJournalDraft(draft({strategy:'x'.repeat(121)})),/exceeds/);
});
