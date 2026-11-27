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

test('risk dropdown and summary refresh use shared setup form and margin-adjusted buying power',()=>{
 assert.match(component,/<select id="rm-risk-mode" aria-label="Risk mode"/);
 assert.match(component,/id="rm-trade-setup"[^\n]*onSubmit=\{lookup\}/);
 const summary=component.slice(component.indexOf('id="rm-summary-title"'),component.indexOf('className="rm-card rm-sizing-panel"'));
 assert.ok(summary.indexOf('form="rm-trade-setup"')>=0);
 assert.ok(summary.indexOf('form="rm-trade-setup"')<summary.indexOf('className="rm-result rm-summary-result"'));
 assert.match(component,/Math.min\(data.equity\*marginRatio,data.buyingPower\?\?Infinity\)/);
 assert.match(component,/Estimated buying power/);
});

test('ATR settings follow margin in setup and direction is in summary header',()=>{
 const setup=component.slice(component.indexOf('<aside className="rm-card rm-market-panel"'),component.indexOf('</aside>'));
 assert.ok(setup.indexOf('className="rm-atr-settings"')>setup.indexOf('id="rm-margin"'));
 assert.match(setup,/id="rm-atr"/);
 assert.match(setup,/id="rm-atr-mult"/);
 assert.match(setup,/5-minute ATR\(14\)/);
 const summary=component.slice(component.indexOf('id="rm-summary-title"'),component.indexOf('className="rm-result rm-summary-result"'));
 assert.match(summary,/aria-label="Trade direction"/);
 assert.doesNotMatch(summary,/rm-card-tag/);
 assert.equal(component.split('aria-label="Trade direction"').length-1,1);
});

test('summary metrics occupy one desktop row and precise entry and stop share the grid',()=>{
 const header=component.slice(component.indexOf('id="rm-summary-title"'),component.indexOf('className="rm-result rm-summary-result"'));
 assert.match(header,/className="rm-summary-refresh"/);
 assert.match(header,/aria-label="Trade direction"/);
 assert.match(css,/\.rm-summary-panel \.rm-summary-metrics\[data-sizing-mode=precise\]\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(component,/<div className="rm-field"><label htmlFor="rm-entry">[^\n]*\n <div className="rm-field"><label htmlFor="rm-stop">/);
 assert.match(css,/\.rm-atr-settings \.rm-reset\{margin-top:10px\}/);
});

test('summary heading and share count are grouped beside horizontal refresh controls',()=>{
 const header=component.slice(component.indexOf('className="rm-card-heading rm-summary-header"'),component.indexOf('className="rm-result rm-summary-result"'));
 assert.ok(header.indexOf('id="rm-summary-title"')<header.indexOf('className="rm-result-label"'));
 assert.ok(header.indexOf('className="rm-share-count"')<header.indexOf('className="rm-summary-actions"'));
 assert.match(header,/form="rm-trade-setup"/);
 assert.match(css,/\.rm-summary-panel \.rm-summary-actions \.rm-summary-refresh button\{width:auto;min-height:42px/);
});

test('ticker is moved into summary before refresh and controls share height',()=>{
 const actions=component.slice(component.indexOf('className="rm-summary-actions"'),component.indexOf('className="rm-result rm-summary-result"'));
 assert.match(actions,/<input id="rm-symbol" className="rm-summary-ticker" form="rm-trade-setup" aria-label="Ticker"/);
 assert.match(actions,/placeholder="Ticker"/);
 assert.ok(actions.indexOf('id="rm-symbol"')<actions.indexOf('className="rm-summary-refresh"'));
 assert.ok(actions.indexOf('className="rm-summary-refresh"')<actions.indexOf('aria-label="Trade direction"'));
 assert.equal(component.split('id="rm-symbol"').length-1,1);
 assert.doesNotMatch(component,/<label htmlFor="rm-symbol"/);
 assert.match(css,/--rm-action-height:44px/);
 for(const selector of ['.rm-summary-ticker','.rm-summary-refresh button','.rm-direction'])assert.ok(css.split('\n').some(line=>line.includes(selector)&&line.includes('height:var(--rm-action-height)')));
});
