import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTradeReview} from '../src/lib/review/trade-review.ts';
import {buildDashboardData,last30DailyBars} from '../src/lib/review/dashboard.ts';
const row=(id,symbol,side,price,at)=>({id,accountId:'1',symbol,side,quantity:'1',price,executedAt:at,fees:'0',feeKnown:true});
const at=(day,min)=>'2026-11-'+day+'T14:'+min+':00Z';
test('dashboard derives completed trade and realized-day figures from same FIFO data',()=>{
 const rows=[row('a','A','BUY','10',at('20','00')),row('b','A','SELL','12',at('20','01')),
 row('c','B','BUY','8',at('21','00')),row('d','B','SELL','7',at('21','01'))];
 const review=buildTradeReview(rows);
 const dashboard=buildDashboardData(review.trades,review.sessions,1,review.openPositions.length);
 assert.equal(dashboard.completed.trades,2);
 assert.equal(dashboard.completed.net,'1');
 assert.equal(dashboard.daily.netSubtotal,'1');
 assert.equal(dashboard.completed.winRate,50);
 assert.equal(dashboard.direction[0].name,'LONG');
 assert.equal(dashboard.symbols.length,2);
 assert.equal(dashboard.recentDays[0].date,'2026-11-21');
});
test('partially closed open positions count in daily results, not completed trade totals',()=>{
 const rows=[row('a','A','BUY','10',at('20','00')),
  row('b','A','BUY','10',at('20','01')),row('c','A','SELL','12',at('20','02'))];
 const r=buildTradeReview(rows);
 const data=buildDashboardData(r.trades,r.sessions,1,r.openPositions.length);
 assert.equal(data.completed.trades,0);
 assert.equal(data.daily.netSubtotal,'2');
 assert.equal(data.openPositions,1);
});
test('unknown daily net is flagged, not plotted as zero',()=>{
 const r=buildTradeReview([row('a','A','BUY','10',at('20','00')),
  row('b','A','SELL','12',at('20','01'))]);
 r.sessions.push({...r.sessions[0],date:'2026-11-21',accountId:'2',net:null,fees:null});
 const data=buildDashboardData(r.trades,r.sessions,2,0);
 assert.equal(data.daily.unverifiedDays,1);
 assert.equal(data.daily.netSubtotal,'2');
 const bars=last30DailyBars(data.last30Days);
 assert.equal(bars.find(b=>b.date==='2026-11-21')?.amount,null);
});
test('empty dashboard works without generated statistics',()=>{
 const data=buildDashboardData([],[],0,0);
 assert.equal(data.completed.winRate,null);
 assert.equal(data.daily.activeDays,0);
 assert.deepEqual(data.symbols,[]);
 assert.deepEqual(last30DailyBars(data.last30Days),[]);
});
