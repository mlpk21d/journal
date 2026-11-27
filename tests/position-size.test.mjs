import test from 'node:test';
import assert from 'node:assert/strict';
import {positionSize} from '../src/lib/risk/position-size.ts';
const base={equity:25000,buyingPower:25000,entry:150,stop:149.6,riskPercent:.25,slippage:.02,fees:0,direction:'LONG'};
test('uses account equity and rounds down whole shares',()=>{const r=positionSize(base);assert.equal(r.shares,148);assert.equal(r.budget,62.5);assert.ok(r.estimatedLoss<=r.budget);});
test('caps by buying power',()=>assert.equal(positionSize({...base,buyingPower:1000}).shares,6));
test('short stops and invalid inputs',()=>{assert.equal(positionSize({...base,direction:'SHORT',stop:150.4}).shares,148);assert.equal(positionSize({...base,stop:151}),null);assert.equal(positionSize({...base,riskPercent:0}),null);});
test('fees reduce risk shares and unaffordable fees produce zero',()=>{assert.equal(positionSize({...base,fees:10}).shares,125);assert.equal(positionSize({...base,fees:100}).shares,0);});
