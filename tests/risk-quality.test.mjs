import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRiskReport} from '../src/lib/review/risk-quality.ts';
const trade=(id,net,duration=600000,i=0)=>({
 id:String(id),symbol:'NVDA',accountId:'1',direction:'LONG',quantity:'1',
 entryPrice:'10',exitPrice:'10',gross:net??'0',fees:net===null?null:'0',net,
 enteredAt:new Date(Date.UTC(2026,10,23,13,0+i)).toISOString(),
 exitedAt:new Date(Date.UTC(2026,10,23,14,0+i)).toISOString(),durationMs:duration,
 entryIds:[],exitIds:[],matchCount:1
});
test('averages and payoff ratio use only known P&L with fixed-point totals',()=>{
 const r=buildRiskReport([trade('a','10'),trade('b','5'),trade('c','-6'),trade('d','-4'),trade('e','0'),trade('f',null)]);
 assert.equal(r.verified,5);assert.equal(r.unverified,1);
 assert.equal(r.averageWinner,'7.5');assert.equal(r.averageLoser,'-5');
 assert.equal(r.payoffRatio,1.5);
 assert.equal(r.verifiedNetSubtotal,'5');
 assert.equal(r.largestWinner,'10');assert.equal(r.largestLoser,'-6');
 assert.ok(Math.abs((r.largestWinnerShare??0)-100*10/15)<1e-10);
});
test('drawdown tracks chronological verified segments and resets after unknown P&L',()=>{
 const rows=[trade('a','10',600000,0),trade('b','-3',600000,1),trade('c','-5',600000,2),
  trade('d',null,600000,3),trade('e','-8',600000,4),trade('f','4',600000,5)];
 const r=buildRiskReport([...rows].reverse());
 assert.equal(r.maxVerifiedSegmentDrawdown,'8');
 assert.equal(r.longestLosingStreak,2);
 assert.equal(r.currentLosingStreak,0);
 assert.equal(r.points[3].segmentNet,null);
 assert.equal(r.points[4].segmentNet,'-8');
});
test('losing streaks end with breakeven, win or unknown trade',()=>{
 const r=buildRiskReport([
 trade('a','-1',0,0),trade('b','-1',0,1),trade('c','0',0,2),
 trade('d','-3',0,3),trade('e',null,0,4),trade('f','-2',0,5)
 ]);
 assert.equal(r.longestLosingStreak,2);assert.equal(r.currentLosingStreak,1);
});
test('duration buckets use lower-inclusive upper-exclusive boundaries',()=>{
 const values=[0,300000,900000,3600000,14400000,86400000];
 const r=buildRiskReport(values.map((d,i)=>trade(i,'1',d,i)));
 assert.deepEqual(r.durations.map(g=>g.trades),[1,1,1,1,1,1]);
 assert.equal(r.durations[0].average,'1');
});
test('empty data and only unknown P&L return unavailable ratios and drawdown',()=>{
 const empty=buildRiskReport([]);
 assert.equal(empty.payoffRatio,null);assert.equal(empty.maxVerifiedSegmentDrawdown,null);
 const unknown=buildRiskReport([trade('x',null)]);
 assert.equal(unknown.averageNet,null);assert.equal(unknown.maxVerifiedSegmentDrawdown,null);
});
