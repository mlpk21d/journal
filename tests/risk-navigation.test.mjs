import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const nav=readFileSync(new URL('../src/components/navigation.tsx',import.meta.url),'utf8');
test('risk management uses a distinct shared icon and one quick rail shortcut',()=>{
 assert.match(nav,/const riskManagement:Item=\{href:'\/risk-management',label:'Risk Management',glyph:'shield'\}/);
 assert.match(nav,/if\(glyph==='shield'\)return <svg/);
 assert.match(nav,/const actions:Item\[\]=\[\s*riskManagement,/);
 assert.match(nav,/primary\.slice\(0,3\),riskManagement,\.\.\.actions\.filter\(item=>item\.href!==riskManagement\.href\)/);
 assert.equal(nav.split('<NavGlyph glyph={item.glyph}/>').length-1,2);
});
