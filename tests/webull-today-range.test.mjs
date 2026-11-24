import test from 'node:test';
import assert from 'node:assert/strict';
import {todayEasternRange} from '../src/lib/webull/today-range.ts';
test('normal November date covers the entire Eastern calendar day',()=>{
 const r=todayEasternRange(new Date('2026-11-24T18:00:00.000Z'));
 assert.deepEqual(r,{date:'2026-11-24',start:'2026-11-24T05:00:00.000Z',end:'2026-11-25T05:00:00.000Z'});
});
test('UTC early morning remains previous date in New York',()=>{
 const r=todayEasternRange(new Date('2026-11-24T02:00:00.000Z'));
 assert.equal(r.date,'2026-11-23');
 assert.equal(r.start,'2026-11-23T05:00:00.000Z');
});
test('spring DST day imports exactly 23 hours',()=>{
 const r=todayEasternRange(new Date('2026-03-08T16:00:00.000Z'));
 assert.equal(r.start,'2026-03-08T05:00:00.000Z');
 assert.equal(r.end,'2026-03-09T04:00:00.000Z');
});
test('fall DST day imports exactly 25 hours',()=>{
 const r=todayEasternRange(new Date('2026-11-01T16:00:00.000Z'));
 assert.equal(r.start,'2026-11-01T04:00:00.000Z');
 assert.equal(r.end,'2026-11-02T05:00:00.000Z');
});
