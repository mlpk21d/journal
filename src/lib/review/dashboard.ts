import {parseFixed,formatFixed} from '../performance/ledger.ts';
import {calculateMetrics,type AnalyticsMetrics,type AnalyticsTrade} from './analytics.ts';
import type {ReviewedTrade,ReviewSession} from './trade-review.ts';
import {summarizeDailySessions,type DailySummary} from './daily-performance.ts';

export type DashboardGroup={name:string;count:number;verified:number;net:string;winRate:number|null};
export type DashboardData={
 completed:AnalyticsMetrics;daily:DailySummary;
 accounts:number;openPositions:number;
 direction:DashboardGroup[];symbols:DashboardGroup[];
 recentDays:DailySummary['days'];
 last30Days:DailySummary['days'];
 unverifiedTrades:number;
};
const toRows=(trades:ReviewedTrade[]):AnalyticsTrade[]=>trades.map(trade=>({
 trade,strategy:'',mistake:'Not reviewed',status:'missing'
}));
const group=(trades:ReviewedTrade[],key:(t:ReviewedTrade)=>string,limit:number):DashboardGroup[]=>{
 const map=new Map<string,ReviewedTrade[]>();
 for(const t of trades){const name=key(t);const rows=map.get(name)??[];rows.push(t);map.set(name,rows);}
 return [...map].map(([name,rows])=>{
  const m=calculateMetrics(toRows(rows));
  return {name,count:m.trades,verified:m.verified,net:m.net,winRate:m.winRate};
 }).sort((a,b)=>{
  const aa=parseFixed(a.net),bb=parseFixed(b.net);
  return aa===bb?a.name.localeCompare(b.name):aa>bb?-1:1;
 }).slice(0,limit);
};
export function buildDashboardData(
 trades:ReviewedTrade[],sessions:ReviewSession[],accounts:number,openPositions:number
):DashboardData{
 const completed=calculateMetrics(toRows(trades));
 const daily=summarizeDailySessions(sessions);
 const mostRecent=daily.days.at(-1)?.date;
 // Last 30 calendar days relative to the latest realized exit, not machine time.
 // Only for the daily bar chart; lifetime metrics remain unfiltered.
 const cutoff=mostRecent?new Date(mostRecent+'T00:00:00Z'):null;
 if(cutoff)cutoff.setUTCDate(cutoff.getUTCDate()-29);
 const start=cutoff?.toISOString().slice(0,10);
 return {
  completed,daily,accounts,openPositions,
  direction:group(trades,t=>t.direction,2),
  symbols:group(trades,t=>t.symbol,8),
  recentDays:daily.days.slice(-8).reverse(),
  last30Days:daily.days.filter(d=>!start||d.date>=start),
  unverifiedTrades:completed.unverified
 };
}
/** All unknown-net daily results are excluded from the signed bar totals. */
export function last30DailyBars(days:DashboardData['last30Days']){
 return days.map(day=>({
  date:day.date,net:day.net,known:day.net!==null,
  amount:day.net===null?null:Number(day.net)
 }));
}
