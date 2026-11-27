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

test('shared risk controls belong in trade setup above margin and summary precedes sizing tabs',()=>{
 const setup=component.slice(component.indexOf('<aside className="rm-card rm-market-panel"'),component.indexOf('</aside>'));
 assert.ok(setup.indexOf('id="rm-shared-risk"')>=0);
 assert.ok(setup.indexOf('id="rm-shared-risk"')<setup.indexOf('id="rm-margin"'));
 assert.ok(component.indexOf('id="rm-summary-title"')<component.indexOf('aria-label="Position sizing mode"'));
 assert.match(component,/const activeSize=sizingTab==='quick'\?quick:size/);
 for(const label of ['Risk budget','Position value','Estimated loss incl. costs'])assert.equal(component.split('<small>'+label+'</small>').length-1,1);
});

test('risk calculator TSX parses without syntax errors and contains one sizing workspace',async()=>{
 const ts=await import('typescript');
 const source=ts.createSourceFile('risk-calculator.tsx',component,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.deepEqual(source.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[]);
 for(const marker of ['aria-label="Position sizing mode"','id="rm-quick-title"','id="rm-precise-title"','id="rm-summary-title"'])assert.equal(component.split(marker).length-1,1);
});

test('risk switch and summary refresh use shared setup form and margin-adjusted buying power',()=>{
 assert.match(component,/role="switch" aria-label="Risk mode"/);
 assert.match(component,/id="rm-trade-setup"[^\n]*onSubmit=\{lookup\}/);
 const summary=component.slice(component.indexOf('id="rm-summary-title"'),component.indexOf('className="rm-card rm-sizing-panel"'));
 assert.ok(summary.indexOf('form="rm-trade-setup"')>summary.indexOf('Estimated loss incl. costs'));
 assert.match(component,/Math.min\(data.equity\*marginRatio,data.buyingPower\?\?Infinity\)/);
 assert.match(component,/Estimated buying power/);
});
