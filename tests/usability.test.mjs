import test from 'node:test';
import assert from 'node:assert/strict';
import {displayAccount} from '../src/lib/review/account-label.ts';
import {COMMON_STRATEGIES} from '../src/lib/review/strategies.ts';
import {normalizeReviewColumns} from '../src/lib/review/columns.ts';
test('manual brokerage labels do not leak internal account identifiers',()=>{
 assert.equal(displayAccount({broker:'manual',user_label:'Schwab IRA',account_type:'Manual',external_account_id:'manual:uuid'}),'Schwab IRA');
 assert.equal(displayAccount({broker:'manual',user_label:'',account_type:null,external_account_id:'manual:uuid'}),'Manual brokerage');
 assert.match(displayAccount({broker:'webull',user_label:'Ignore me',account_type:'INDIVIDUAL',external_account_id:'ABCD1234'}),/INDIVIDUAL-ABC\*\*34/);
});
test('common strategies contain requested trading styles without duplicate options',()=>{
 assert.ok(COMMON_STRATEGIES.includes('Mean Reversion'));
 assert.ok(COMMON_STRATEGIES.includes('Breakout'));
 assert.equal(new Set(COMMON_STRATEGIES).size,COMMON_STRATEGIES.length);
});
test('stored review preferences always retain the mandatory columns',()=>{
 assert.deepEqual(normalizeReviewColumns(['account']),['ticker','account','direction','net']);
 assert.deepEqual(normalizeReviewColumns([]),['ticker','direction','net']);
});
