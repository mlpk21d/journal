import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPerformanceInsights} from '../src/lib/review/performance-insights.ts';
const make=(i,net,strategy='ORB',status='verified',direction='LONG')=>({
 trade:{id:String(i),accountId:'1',symbol:'NVDA',direction,net,
  enteredAt:'2026-11-23T14:30:00Z',exitedAt:'2026-11-23T15:00:00Z'},
 strategy,mistake:'None recorded',status
});
test('requires minimum verified sample and sufficient verified coverage for ranking',()=>{
 const rows=[...Array.from({length:19},(_,i)=>make(i,'2'))];
 const small=buildPerformanceInsights(rows,20);
 assert.equal(small.qualifying,0);assert.equal(small.strongest.length,0);
 assert.ok(small.groups.every(g=>!g.eligible));
 const qualified=buildPerformanceInsights([...rows,make(19,'2')],20);
 assert.ok(qualified.qualifying>0);
 assert.equal(qualified.groups.find(g=>g.dimension==='Strategy')?.metrics.verified,20);
 const under=buildPerformanceInsights([...rows.slice(0,15),...Array.from({length:5},(_,i)=>make(i+20,null))],15);
 assert.equal(under.groups.find(g=>g.dimension==='Direction')?.eligible,false);
 assert.match(under.groups.find(g=>g.dimension==='Direction')?.reason??'',/80%/);
});
test('only matching journal notes count toward named strategy groups',()=>{
 const rows=[make(1,'10'),make(2,'-2','Other','stale'),make(3,'5','Other','missing')];
 const report=buildPerformanceInsights(rows,2);
 assert.equal(report.groups.filter(g=>g.dimension==='Strategy').length,1);
 assert.equal(report.groups.find(g=>g.dimension==='Strategy')?.label,'ORB');
 assert.equal(report.staleNotes,1);assert.equal(report.unreviewedNotes,1);
 assert.equal(report.overall.net,'13');
});
test('ranking uses average net, not total and avoids overlap between top and bottom cards',()=>{
 const rows=[
 ...Array.from({length:20},(_,i)=>make(i,'1','Low','verified','LONG')),
 ...Array.from({length:20},(_,i)=>make(i+20,'5','High','verified','SHORT'))
 ];
 const report=buildPerformanceInsights(rows,20);
 assert.equal(report.groups.find(g=>g.dimension==='Strategy'&&g.label==='High')?.metrics.average,'5');
 assert.equal(report.strongest[0]?.metrics.average,'5');
 assert.ok(report.weakest.length>0,'qualified groups should include a lower-ranked comparison');
 const top=new Set(report.strongest.map(g=>g.dimension+':'+g.label));
 assert.ok(report.weakest.every(g=>!top.has(g.dimension+':'+g.label)));
 assert.equal(report.overall.net,'120');
});
test('invalid sample threshold is rejected',()=>{
 assert.throws(()=>buildPerformanceInsights([],1),/Minimum sample/);
 assert.throws(()=>buildPerformanceInsights([],501),/Minimum sample/);
});
