import test from 'node:test';
import assert from 'node:assert/strict';
import {positionSize,quickPositionSize} from '../src/lib/risk/position-size.ts';
const base={equity:25000,buyingPower:25000,entry:150,stop:149.6,riskPercent:.25,slippage:.02,fees:0,direction:'LONG'};
test('uses account equity and rounds down whole shares',()=>{const r=positionSize(base);assert.equal(r.shares,148);assert.equal(r.budget,62.5);assert.ok(r.estimatedLoss<=r.budget);});
test('caps by buying power',()=>assert.equal(positionSize({...base,buyingPower:1000}).shares,6));
test('short stops and invalid inputs',()=>{assert.equal(positionSize({...base,direction:'SHORT',stop:150.4}).shares,148);assert.equal(positionSize({...base,stop:151}),null);assert.equal(positionSize({...base,riskPercent:0}),null);});
test('fees reduce risk shares and unaffordable fees produce zero',()=>{assert.equal(positionSize({...base,fees:10}).shares,125);assert.equal(positionSize({...base,fees:100}).shares,0);});

test('quick quote-based sizing needs no manual stop',()=>{
 const {stop,...inputs}=base;
 const r=quickPositionSize({...inputs,movePercent:.5});
 assert.equal(r.shares,81);assert.ok(r.estimatedLoss<=r.budget);
 assert.equal(quickPositionSize({...inputs,direction:'SHORT',movePercent:.5}).shares,81);
 assert.equal(quickPositionSize({...inputs,buyingPower:1000,movePercent:.5}).shares,6);
 assert.equal(quickPositionSize({...inputs,movePercent:0}),null);
 assert.equal(quickPositionSize({...inputs,movePercent:100}),null);
});

test('fixed dollar risk works for precise and quick sizing',()=>{
 const {riskPercent,...inputs}=base;
 const fixed={...inputs,riskDollars:50};
 const r=positionSize(fixed);assert.equal(r.budget,50);assert.equal(r.shares,119);assert.ok(r.estimatedLoss<=50);
 assert.equal(positionSize({...fixed,equity:50000}).shares,119);
 assert.equal(positionSize({...fixed,riskDollars:0}),null);
 assert.equal(positionSize({...fixed,riskDollars:25001}),null);
 const {stop,...quick}=fixed;assert.equal(quickPositionSize({...quick,movePercent:.5}).shares,64);
});
