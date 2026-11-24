import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTaxLotPreview} from '../src/lib/review/wash-tax-lots.ts';
const iso=(date)=>date+'T15:00:00.000Z';
const row=(id,side,quantity,price,date,accountId='1',symbol='NVDA')=>({
 id,accountId,symbol,side,quantity,price,executedAt:iso(date),fees:'0',feeKnown:true
});
const accounts=[{id:'1',label:'Individual',type:'Individual'},
 {id:'2',label:'Additional taxable',type:'Individual'},
 {id:'3',label:'Roth',type:'Roth IRA'}];
test('partial post-sale replacement carries only matched shares and defers proportional net loss',()=>{
 const trades=[
  row('a','BUY','100','10','2026-01-01'),row('b','SELL','100','8','2026-01-10'),
  row('c','BUY','40','9','2026-01-11')
 ];
 const report=buildTaxLotPreview(trades,accounts,'2026-03-01');
 assert.equal(report.dispositions.length,1);
 assert.equal(report.dispositions[0].originalNet,'-200');
 assert.equal(report.dispositions[0].disallowed,'80');
 assert.equal(report.dispositions[0].estimatedTaxNet,'-120');
 assert.equal(report.openLots[0].basisIncrease,'80');
 assert.equal(report.openLots[0].estimatedBasis,'440');
 assert.equal(report.openDeferredBasis,'80');
 assert.equal(report.adjustments[0].quantity,'40');
});
test('wash chains carry adjusted loss into a second losing disposition then its open replacement',()=>{
 const trades=[
  row('b1','BUY','10','10','2026-01-01'),
  row('s1','SELL','10','8','2026-01-02'),
  row('b2','BUY','10','9','2026-01-03'),
  row('s2','SELL','10','8','2026-01-04'),
  row('b3','BUY','10','10','2026-01-05')
 ];
 const report=buildTaxLotPreview(trades,accounts,'2026-03-01');
 assert.deepEqual(report.dispositions.map(d=>d.originalNet),['-20','-10']);
 assert.deepEqual(report.dispositions.map(d=>d.estimatedTaxNet),['0','0']);
 assert.deepEqual(report.dispositions.map(d=>d.basisIncrease),['0','20']);
 assert.deepEqual(report.adjustments.map(x=>x.disallowed),['20','30']);
 assert.equal(report.openDeferredBasis,'30');
 assert.equal(report.openLots[0].holdingStart,iso('2026-01-01'));
});
test('replacement bought before loss counts only if shares remain after losing sale',()=>{
 const rows=[
  row('b1','BUY','10','10','2026-01-01'),
  row('b2','BUY','10','9','2026-01-02'),
  row('s1','SELL','10','8','2026-01-03')
 ];
 const report=buildTaxLotPreview(rows,accounts,'2026-03-01');
 assert.equal(report.adjustments.length,1);
 assert.equal(report.adjustments[0].purchaseId,'b2');
 assert.equal(report.adjustments[0].disallowed,'20');
 assert.equal(report.openLots[0].estimatedBasis,'110');
});
test('replacement acquired in another Roth IRA has no tax-basis carry',()=>{
 const rows=[row('b1','BUY','10','10','2026-01-01'),
  row('s1','SELL','10','8','2026-01-02'),
  row('b2','BUY','10','9','2026-01-03','3')];
 const r=buildTaxLotPreview(rows,accounts,'2026-03-01');
 assert.equal(r.adjustments[0].treatment,'ira-permanent');
 assert.equal(r.adjustments[0].purchaseAccountId,'3');
 assert.equal(r.iraDisallowed,'20');
 assert.equal(r.openDeferredBasis,'0');
 assert.equal(r.openLots[0].estimatedBasis,'90');
});
test('one partially filled replacement order cannot be reused for two losses',()=>{
 // The original purchase must be outside the 30-day lookback; otherwise
 // its unsold shares can independently qualify as a prior replacement.
 const rows=[row('b1','BUY','10','10','2025-11-01'),
  row('s1','SELL','5','8','2026-01-02'),
  row('s2','SELL','5','8','2026-01-03'),
  row('b2','BUY','6','9','2026-01-04')];
 const r=buildTaxLotPreview(rows,accounts,'2026-03-01');
 assert.deepEqual(r.adjustments.map(x=>x.quantity),['5','1']);
 assert.equal(r.openDeferredBasis,'12');
 assert.deepEqual(r.dispositions.map(x=>x.estimatedTaxNet),['0','-8']);
});
test('outside 30-day replacement and short losses are not adjusted',()=>{
 const noWash=[row('b1','BUY','10','10','2026-01-01'),
  row('s1','SELL','10','8','2026-01-02'),
  row('b2','BUY','10','9','2026-02-02')];
 assert.equal(buildTaxLotPreview(noWash,accounts,'2026-03-01').adjustments.length,0);
 const short=[row('s1','SELL','10','10','2026-01-01'),
  row('b1','BUY','10','12','2026-01-02')];
 const result=buildTaxLotPreview(short,accounts,'2026-03-01');
 assert.equal(result.shortMatches,1);
 assert.equal(result.dispositions.length,0);
});
test('unknown fee data remains unresolved; original orders are not modified',()=>{
 const orders=[row('b1','BUY','10','10','2026-01-01'),row('s1','SELL','10','8','2026-01-02')];
 orders[1].fees=null;orders[1].feeKnown=false;
 const copy=structuredClone(orders);
 const r=buildTaxLotPreview(orders,accounts,'2026-01-10');
 assert.equal(r.unknownNetMatches,1);
 assert.equal(r.dispositions[0].estimatedTaxNet,null);
 assert.deepEqual(orders,copy);
});

test('losses realized inside an IRA do not appear in taxable realized P&L',()=>{
 const rows=[row('b1','BUY','10','10','2026-01-01','3'),
  row('s1','SELL','10','8','2026-01-02','3'),
  row('b2','BUY','10','9','2026-01-03','1')];
 const r=buildTaxLotPreview(rows,accounts,'2026-03-01');
 assert.equal(r.retirementSourceMatches,1);
 assert.equal(r.dispositions[0].estimatedTaxNet,null);
 assert.equal(r.adjustments.length,0);
 assert.equal(r.knownOriginalNet,'0');
 assert.equal(r.knownEstimatedTaxNet,'0');
});
test('purchase exactly 30 calendar days after a loss is inside the window',()=>{
 const rows=[row('b1','BUY','10','10','2026-01-01'),
  row('s1','SELL','10','8','2026-01-02'),
  row('b2','BUY','10','9','2026-02-01')];
 const r=buildTaxLotPreview(rows,accounts,'2026-03-01');
 assert.equal(r.adjustments.length,1);
 assert.equal(r.adjustments[0].disallowed,'20');
});

test('a realized gain on later sale of replacement releases its carried loss',()=>{
 const rows=[row('b1','BUY','10','10','2026-01-01'),
  row('s1','SELL','10','8','2026-01-02'),
  row('b2','BUY','10','9','2026-01-03'),
  row('s2','SELL','10','12','2026-02-20')];
 const r=buildTaxLotPreview(rows,accounts,'2026-03-31');
 assert.deepEqual(r.dispositions.map(x=>x.estimatedTaxNet),['0','10']);
 assert.equal(r.knownOriginalNet,'10');
 assert.equal(r.knownEstimatedTaxNet,'10');
 assert.equal(r.openDeferredBasis,'0');
});
test('a purchase in another taxable account receives carried basis, not a new wash after it sells at gain',()=>{
 const rows=[row('b1','BUY','10','10','2026-01-01'),
  row('s1','SELL','10','8','2026-01-02'),
  row('b2','BUY','10','9','2026-01-03','2')];
 const r=buildTaxLotPreview(rows,accounts,'2026-03-01');
 assert.equal(r.adjustments[0].purchaseAccountId,'2');
 assert.equal(r.adjustments[0].treatment,'basis-carry');
 assert.equal(r.openLots[0].accountId,'2');
 assert.equal(r.openLots[0].basisIncrease,'20');
});
test('December sales can defer losses into January replacement shares',()=>{
 const rows=[row('b1','BUY','10','10','2025-12-01'),
  row('s1','SELL','10','8','2025-12-29'),
  row('b2','BUY','10','9','2026-01-05')];
 const r=buildTaxLotPreview(rows,accounts,'2026-02-15');
 assert.equal(r.adjustments.length,1);
 assert.equal(r.adjustments[0].saleDate,'2025-12-29');
 assert.equal(r.adjustments[0].purchaseDate,'2026-01-05');
 assert.equal(r.dispositions[0].estimatedTaxNet,'0');
 assert.equal(r.openDeferredBasis,'20');
});
