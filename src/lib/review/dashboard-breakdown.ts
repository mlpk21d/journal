import {parseFixed,formatFixed} from '../performance/ledger.ts';
import type {ReviewedTrade} from './trade-review.ts';

export type TradePerformanceSummary={
 trades:number;verified:number;unverified:number;wins:number;losses:number;
 net:string;winRate:number|null;averageWin:string|null;averageLoss:string|null;
};
export type WeekdayPerformance=TradePerformanceSummary&{day:'Mon'|'Tue'|'Wed'|'Thu'|'Fri'};
export type DirectionPerformance=TradePerformanceSummary&{direction:'LONG'|'SHORT'};
export type DashboardBreakdown={directions:DirectionPerformance[];weekdays:WeekdayPerformance[]};
const weekdays=['Mon','Tue','Wed','Thu','Fri'] as const;
const dayFormatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short'});

function summarize(trades:ReviewedTrade[]):TradePerformanceSummary{
 let net=0n,gains=0n,losses=0n,wins=0,lossCount=0,verified=0;
 for(const trade of trades){
  if(trade.net===null)continue;
  verified++;
  const amount=parseFixed(trade.net);
  net+=amount;
  if(amount>0n){wins++;gains+=amount;}
  else if(amount<0n){lossCount++;losses-=amount;}
 }
 return {
  trades:trades.length,verified,unverified:trades.length-verified,wins,losses:lossCount,
  net:formatFixed(net),
  winRate:verified?wins/verified*100:null,
  averageWin:wins?formatFixed(gains/BigInt(wins)):null,
  averageLoss:lossCount?formatFixed(losses/BigInt(lossCount)):null
 };
}

/** Groups completed, flat-to-flat FIFO cycles by direction and their ENTRY
 * weekday in New York. Weekends are excluded only from the weekday chart.
 * Unknown-fee trades count toward activity but NOT monetary results/win rate.
 */
export function buildDashboardBreakdown(trades:ReviewedTrade[]):DashboardBreakdown{
 const directions=(['LONG','SHORT'] as const).map(direction=>({
  direction,...summarize(trades.filter(trade=>trade.direction===direction))
 }));
 const weekdayBuckets=new Map<string,ReviewedTrade[]>(weekdays.map(day=>[day,[]]));
 for(const trade of trades){
  const day=dayFormatter.format(new Date(trade.enteredAt));
  weekdayBuckets.get(day)?.push(trade);
 }
 const byWeekday=weekdays.map(day=>({day,...summarize(weekdayBuckets.get(day)??[])}));
 return {directions,weekdays:byWeekday};
}
