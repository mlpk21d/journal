import test from 'node:test';
import assert from 'node:assert/strict';
import {metricBarWidth,dashboardBarScales} from '../src/lib/review/dashboard-metric-bars.ts';
test('zero values retain a tiny visible left color mark',()=>{
 assert.equal(metricBarWidth(0,20),2);
 assert.equal(metricBarWidth(-1,20),2);
 assert.equal(metricBarWidth(NaN,20),2);
});
test('bar widths scale to actual metric values rather than constant widths',()=>{
 const r=dashboardBarScales({wins:13,losses:11,open:0,washSales:2,averageWin:22.40,averageLoss:62.68});
 assert.equal(r.wins,100);
 assert.ok(r.losses>80&&r.losses<90);
 assert.equal(r.open,2);
 assert.ok(r.washSales>2&&r.washSales<20);
 assert.ok(r.averageWin>30&&r.averageWin<40);
 assert.equal(r.averageLoss,100);
});
test('all-zero dataset keeps each category visible without inventing a metric',()=>{
 const r=dashboardBarScales({wins:0,losses:0,open:0,washSales:0,averageWin:0,averageLoss:0});
 assert.ok(Object.values(r).every(w=>w===2));
});
