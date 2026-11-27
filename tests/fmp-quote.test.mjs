import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFmpQuote,FmpQuoteError} from '../src/lib/risk/fmp-quote.ts';
const now=1785430820000;
test('uses matching ticker, price and provider timestamp',()=>{
 assert.deepEqual(parseFmpQuote([{symbol:'AMD',price:10},{symbol:'NVDA',price:150.25,timestamp:1785430812}],'NVDA',now),{price:150.25,quoteTime:1785430812000,quoteFetchedAt:now});
});
test('missing or future timestamp is unknown, not fetch time',()=>{
 assert.equal(parseFmpQuote([{symbol:'NVDA',price:150}],'NVDA',now).quoteTime,null);
 assert.equal(parseFmpQuote([{symbol:'NVDA',price:150,timestamp:now+120000}],'NVDA',now).quoteTime,null);
});
test('rejects missing ticker, zero price and error payload',()=>{
 for(const raw of [[],[{symbol:'AMD',price:10}],[{symbol:'NVDA',price:0}],{'Error Message':'Denied'}])assert.throws(()=>parseFmpQuote(raw,'NVDA',now),FmpQuoteError);
});
