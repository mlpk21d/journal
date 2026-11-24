import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DASHBOARD_TRADES_PAGE_SIZE,paginateDashboardTrades} from '../src/lib/review/dashboard-pagination.ts';
const sample=(i)=>({id:String(i),exitedAt:new Date(Date.UTC(2026,0,1+i)).toISOString()});
test('dashboard displays exactly 50 trades before creating page 2',()=>{
 assert.equal(DASHBOARD_TRADES_PAGE_SIZE,50);
 const data=Array.from({length:120},(_,i)=>sample(i));
 const p1=paginateDashboardTrades(data,1),p2=paginateDashboardTrades(data,2),p3=paginateDashboardTrades(data,3);
 assert.equal(p1.totalPages,3);
 assert.equal(p1.visible.length,50);
 assert.equal(p2.visible.length,50);
 assert.equal(p3.visible.length,20);
 assert.equal(new Set([ ...p1.visible,...p2.visible,...p3.visible ].map(x=>x.id)).size,120);
 assert.equal(p1.visible[0].id,'119');
 assert.equal(p3.visible.at(-1).id,'0');
 assert.deepEqual(data.map(x=>x.id).slice(0,3),['0','1','2']);
});
test('dashboard pagination handles empty, one-page and out of bounds requests',()=>{
 assert.deepEqual(paginateDashboardTrades([],10).visible,[]);
 assert.equal(paginateDashboardTrades([],10).currentPage,1);
 const data=Array.from({length:50},(_,i)=>sample(i));
 assert.equal(paginateDashboardTrades(data,1).totalPages,1);
 assert.equal(paginateDashboardTrades(data,5).currentPage,1);
 assert.equal(paginateDashboardTrades(data,-5).currentPage,1);
 assert.equal(paginateDashboardTrades(data,NaN).currentPage,1);
});
test('dashboard ticker opens shared journal editor modal without redirecting',()=>{
 const dashboard=readFileSync(new URL('../src/components/dashboard-trades.tsx',import.meta.url),'utf8');
 const review=readFileSync(new URL('../src/components/review-trades-table.tsx',import.meta.url),'utf8');
 assert.match(dashboard,/from '@\/components\/review-trades-table'/);
 assert.match(dashboard,/setSelected\(t\.id\)/);
 assert.match(dashboard,/TradeReviewModal id=\{selected\} onClose=\{closeModal\}/);
 assert.doesNotMatch(dashboard,/href=\{'\/review\/trade\?id='/);
 assert.match(review,/export function TradeReviewModal/);
 assert.match(review,/TradeJournalEditor key=\{id\}/);
});
test('dashboard pagination renders accessible navigation with 50-trade totals',()=>{
 const source=readFileSync(new URL('../src/components/dashboard-trades.tsx',import.meta.url),'utf8');
 assert.match(source,/paginateDashboardTrades\(trades,page\)/);
 assert.match(source,/aria-label="Dashboard trade history pages"/);
 assert.match(source,/First/);
 assert.match(source,/Previous/);
 assert.match(source,/Next/);
 assert.match(source,/Last/);
});
