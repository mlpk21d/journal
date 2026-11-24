import {parseFixed} from '../performance/ledger.ts';
import type {AnalyticsMetrics,AnalyticsTrade} from './analytics.ts';
import {calculateMetrics} from './analytics.ts';
import {etParts} from './timing-analytics.ts';

export type InsightDimension='Strategy'|'Direction'|'Entry hour'|'Exit hour'|'Entry weekday'|'Exit weekday';
export type InsightGroup={
 dimension:InsightDimension;label:string;metrics:AnalyticsMetrics;
 eligible:boolean;reason:string|null;coverage:number;
};
export type InsightsReport={
 overall:AnalyticsMetrics;groups:InsightGroup[];strongest:InsightGroup[];weakest:InsightGroup[];
 qualifying:number;insufficient:number;totalTrades:number;verifiedNotes:number;unreviewedNotes:number;staleNotes:number;
};
export const DEFAULT_MIN_SAMPLE=20;
export const MIN_COVERAGE=0.8;
const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] as const;
const dimensions:InsightDimension[]=['Strategy','Direction','Entry hour','Exit hour','Entry weekday','Exit weekday'];

function hourLabel(hour:number){
 return String(hour).padStart(2,'0')+':00 ET';
}
function valueFor(row:AnalyticsTrade,dimension:InsightDimension):string|null{
 switch(dimension){
  case 'Strategy':return row.status==='verified'&&row.strategy!=='No strategy set'?row.strategy:null;
  case 'Direction':return row.trade.direction;
  case 'Entry hour':return hourLabel(etParts(row.trade.enteredAt).hour);
  case 'Exit hour':return hourLabel(etParts(row.trade.exitedAt).hour);
  case 'Entry weekday':return etParts(row.trade.enteredAt).weekday;
  case 'Exit weekday':return etParts(row.trade.exitedAt).weekday;
 }
}
function compareAverage(a:InsightGroup,b:InsightGroup){
 const first=parseFixed(a.metrics.average??'0'),second=parseFixed(b.metrics.average??'0');
 if(first!==second)return first>second?-1:1;
 if(a.metrics.verified!==b.metrics.verified)return b.metrics.verified-a.metrics.verified;
 return a.dimension.localeCompare(b.dimension)||a.label.localeCompare(b.label);
}
/** The same completed trade can occur in multiple dimensions; rankings are
 * descriptive and NOT independent samples or evidence of a predictive edge.
 */
export function buildPerformanceInsights(rows:AnalyticsTrade[],minimum=DEFAULT_MIN_SAMPLE):InsightsReport{
 if(!Number.isSafeInteger(minimum)||minimum<2||minimum>500)
  throw new Error('Minimum sample must be an integer from 2 to 500');
 const groups:InsightGroup[]=[];
 for(const dimension of dimensions){
  const buckets=new Map<string,AnalyticsTrade[]>();
  for(const row of rows){
   const key=valueFor(row,dimension);
   if(key===null)continue; // Never assign stale or absent notes to a named strategy.
   const list=buckets.get(key)??[];list.push(row);buckets.set(key,list);
  }
  const keys=dimension==='Entry weekday'||dimension==='Exit weekday'
   ?weekdays.filter(k=>buckets.has(k)):[...buckets.keys()].sort();
  for(const label of keys){
   const metrics=calculateMetrics(buckets.get(label)??[]);
   const coverage=metrics.trades?metrics.verified/metrics.trades:0;
   const reason=metrics.verified<minimum
    ?'Fewer than '+minimum+' verified trades'
    :coverage<MIN_COVERAGE
     ?'Less than 80% have verified net P&L'
     :null;
   groups.push({dimension,label,metrics,coverage,eligible:reason===null,reason});
  }
 }
 const eligible=groups.filter(g=>g.eligible).sort(compareAverage);
 // Only report a contrast when multiple qualified groups exist; a single
 // qualified bucket is not evidence of a relative best/worst pattern.
 const compare=eligible.length>=2;
 const rankedPerSide=compare?Math.min(3,Math.floor(eligible.length/2)):0;
 const strongest=eligible.slice(0,rankedPerSide);
 const weakest=rankedPerSide?[...eligible].reverse().slice(0,rankedPerSide):[];
 return {
  overall:calculateMetrics(rows),groups,
  strongest,weakest,
  qualifying:eligible.length,insufficient:groups.length-eligible.length,
  totalTrades:rows.length,
  verifiedNotes:rows.filter(r=>r.status==='verified').length,
  staleNotes:rows.filter(r=>r.status==='stale').length,
  unreviewedNotes:rows.filter(r=>r.status==='missing').length
 };
}
