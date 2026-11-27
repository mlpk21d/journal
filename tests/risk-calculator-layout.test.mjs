import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const component=readFileSync(new URL('../src/components/risk-calculator.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/app/globals.css',import.meta.url),'utf8');
test('risk management renders two calculator cards and responsive stacking',()=>{
 assert.match(component,/className="rm-card-grid"/);
 assert.match(component,/aria-labelledby="rm-quick-title"/);
 assert.match(component,/aria-labelledby="rm-precise-title"/);
 assert.match(css,/\.rm-card-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:1000px\)\{\.rm-card-grid\{grid-template-columns:1fr\}/);
});
test('calculator cards preserve fixed automatic ATR and manual stop precedence',()=>{
 assert.match(component,/atr:data\.atr\.value,multiplier:ATR_MULTIPLIER/);
 assert.match(component,/stop\.trim\(\)\?positionSize/);
 assert.match(component,/Restore automatic ATR/);
 assert.equal((component.match(/await loadRiskInputs\(/g)||[]).length,1);
});
