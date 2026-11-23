import test from 'node:test';
import assert from 'node:assert/strict';
import {REVIEW_COLUMNS,REQUIRED_REVIEW_COLUMNS,normalizeReviewColumns} from '../src/lib/review/columns.ts';
test('required ticker, direction, and net P&L cannot be hidden',()=>{
 assert.deepEqual(REQUIRED_REVIEW_COLUMNS,['ticker','direction','net']);
 assert.deepEqual(normalizeReviewColumns([]),REQUIRED_REVIEW_COLUMNS);
 assert.deepEqual(normalizeReviewColumns(['account','fees']),['ticker','account','direction','fees','net']);
});
test('column preferences ignore unknown values and default to all columns',()=>{
 assert.deepEqual(normalizeReviewColumns(null),REVIEW_COLUMNS.map(c=>c.key));
 assert.deepEqual(normalizeReviewColumns(['ticker','ticker','not-real',null,7]),REQUIRED_REVIEW_COLUMNS);
 assert.equal(new Set(REVIEW_COLUMNS.map(c=>c.key)).size,REVIEW_COLUMNS.length);
});
