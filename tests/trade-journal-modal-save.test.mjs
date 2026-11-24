import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('journal form prevents reset on submission and retains drafts after failures',()=>{
 const source=read('src/components/trade-journal-editor.tsx');
 assert.match(source,/event\.preventDefault\(\)/);
 assert.match(source,/const form=new FormData\(event\.currentTarget\)/);
 assert.match(source,/<form onSubmit=\{submit\}>/);
 assert.doesNotMatch(source,/useActionState/);
 assert.doesNotMatch(source,/action=\{action\}/);
 assert.match(source,/else setState\(result\)/);
 assert.match(source,/setState\(\{ok:false,message:/);
});
test('only successful journal save closes a modal, not a validation or network failure',()=>{
 const source=read('src/components/trade-journal-editor.tsx');
 const success=source.indexOf('if(result.ok){');
 const close=source.indexOf('if(onSaved){onSaved();return;}');
 const failure=source.indexOf('}else setState(result);');
 assert.ok(success>=0 && close>success && failure>close);
});
test('shared Dashboard and Review modal receives success-close callback',()=>{
 const modal=read('src/components/review-trades-table.tsx');
 const dashboard=read('src/components/dashboard-trades.tsx');
 assert.match(modal,/TradeJournalEditor key=\{id\}[^>]*onSaved=\{onClose\}/);
 assert.match(dashboard,/TradeReviewModal id=\{selected\}/);
});
test('standalone journal editor remains in place without a modal close callback',()=>{
 const page=read('src/app/review/trade/page.tsx');
 assert.match(page,/<TradeJournalEditor cycleKey=\{audit\.trade\.id\} fingerprint=\{fingerprint\} journal=\{journal\}\/>/);
});
