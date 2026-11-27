import test from 'node:test';
import assert from 'node:assert/strict';
import {positionSize,quickPositionSize,atrPositionSize} from '../src/lib/risk/position-size.ts';
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

test('margin ratio caps exposure without multiplying reported buying power',()=>{
 const i={...base,equity:10000,buyingPower:40000,entry:100,stop:99.9,riskPercent:1,slippage:0};
 assert.equal(positionSize(i).shares,200);
 assert.equal(positionSize({...i,marginRatio:1}).shares,100);
 assert.equal(positionSize({...i,marginRatio:2,buyingPower:15000}).shares,150);
 assert.equal(positionSize({...i,marginRatio:1,buyingPower:null}).shares,100);
 for(const ratio of [1,2,3,4,5,6])assert.equal(positionSize({...i,buyingPower:100000,marginRatio:ratio}).shares,ratio*100);
 assert.equal(positionSize({...i,marginRatio:6}).shares,400);
 for(const ratio of [0,2.5,7])assert.equal(positionSize({...i,marginRatio:ratio}),null);
 const {stop,...quick}=i;assert.equal(quickPositionSize({...quick,marginRatio:1,movePercent:.1}).shares,100);
});

test('ATR sizing respects volatility, risk, direction and buying power',()=>{
 const {stop,...inputs}=base;
 assert.equal(atrPositionSize({...inputs,atr:.5,multiplier:1.5}).shares,81);
 assert.equal(atrPositionSize({...inputs,atr:1,multiplier:1.5}).shares,41);
 assert.equal(atrPositionSize({...inputs,atr:.5,multiplier:1.5,direction:'SHORT'}).shares,81);
 assert.equal(atrPositionSize({...inputs,atr:0,multiplier:1.5}),null);
 assert.equal(atrPositionSize({...inputs,atr:.5,multiplier:0}),null);
 assert.equal(atrPositionSize({...inputs,atr:.5,multiplier:1.5,buyingPower:1000}).shares,6);
});
