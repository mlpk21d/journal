import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const component=readFileSync(new URL('../src/components/risk-calculator.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/app/globals.css',import.meta.url),'utf8');
test('risk management renders vertical market inputs and a shared tabbed calculator',()=>{
 assert.match(component,/className="rm-workspace"/);
 assert.match(component,/rm-market-fields/);
 assert.match(component,/hidden=\{sizingTab!=='quick'\}/);
 assert.match(component,/hidden=\{sizingTab!=='precise'\}/);
 assert.match(component,/aria-label="Risk mode"/);
 assert.equal((component.match(/id="rm-shared-risk"/g)||[]).length,1);
 assert.match(css,/\.rm-workspace\{display:grid/);
 assert.match(css,/\.rm-market-fields\{grid-template-columns:1fr/);
 assert.match(css,/@media\(max-width:900px\)\{\.rm-workspace\{grid-template-columns:1fr/);
});
test('calculator cards preserve fixed automatic ATR and manual stop precedence',()=>{
 assert.match(component,/atr:data\.atr\.value,multiplier:ATR_MULTIPLIER/);
 assert.match(component,/stop\.trim\(\)\?positionSize/);
 assert.match(component,/Restore automatic ATR/);
 assert.equal((component.match(/await loadRiskInputs\(/g)||[]).length,1);
});
