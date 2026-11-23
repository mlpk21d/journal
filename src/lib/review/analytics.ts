import {parseFixed,formatFixed,type LedgerInput} from '../performance/ledger.ts';
import type {ReviewedTrade} from './trade-review.ts';
import {tradeFingerprint} from './identity.ts';

export type AnalyticsNote={cycleKey:string;fingerprint:string;strategy:string;mistakes:string};
export type AnalyticsTrade={trade:ReviewedTrade;strategy:string;mistake:'Recorded'|'None recorded'|'Not reviewed'|'Changed history';status:'verified'|'missing'|'stale'};
export type AnalyticsMetrics={
 trades:number;verified:number;unverified:number;wins:number;losses:number;breakeven:number;
 net:string;average:string|null;grossWins:string;grossLosses:string;winRate:number|null;profitFactor:number|null|'∞';
};
export type AnalyticsGroup={label:string;metrics:AnalyticsMetrics};
export type AnalyticsReport={trades:AnalyticsTrade[];overall:AnalyticsMetrics;byStrategy:AnalyticsGroup[];byDirection:AnalyticsGroup[];byMistake:AnalyticsGroup[];annotated:number;stale:number;unreviewed:number};

export function calculateMetrics(items:AnalyticsTrade[]):AnalyticsMetrics{
 let net=0n,gains=0n,losses=0n,wins=0,lossCount=0,breakeven=0,verified=0;
 for(const t of items){
  if(t.trade.net===null)continue;
  verified++;
  const value=parseFixed(t.trade.net);net+=value;
  if(value>0n){wins++;gains+=value;}
  else if(value<0n){lossCount++;losses-=value;}
  else breakeven++;
 }
 return {trades:items.length,verified,unverified:items.length-verified,wins,losses:lossCount,breakeven,
  net:formatFixed(net),average:verified?formatFixed(net/BigInt(verified)):null,
  grossWins:formatFixed(gains),grossLosses:formatFixed(losses),
  winRate:verified?wins/verified*100:null,
  profitFactor:losses>0n?Number(gains)/Number(losses):gains>0n?'∞':null};
}
export function summarizeAnalytics(trades:AnalyticsTrade[]):AnalyticsReport{
 const group=(pick:(t:AnalyticsTrade)=>string):AnalyticsGroup[]=>{
  const buckets=new Map<string,AnalyticsTrade[]>();
  for(const t of trades){const k=pick(t);const list=buckets.get(k)??[];list.push(t);buckets.set(k,list);}
  return [...buckets].map(([label,items])=>({label,metrics:calculateMetrics(items)}))
   .sort((a,b)=>b.metrics.trades-a.metrics.trades||a.label.localeCompare(b.label));
 };
 return {trades,overall:calculateMetrics(trades),byStrategy:group(t=>t.strategy),
  byDirection:group(t=>t.trade.direction),byMistake:group(t=>t.mistake),
  annotated:trades.filter(t=>t.status==='verified').length,
  stale:trades.filter(t=>t.status==='stale').length,
  unreviewed:trades.filter(t=>t.status==='missing').length};
}
/** Never associate a strategy or mistake with a trade whose fingerprint changed. */
export function buildAnalytics(trades:ReviewedTrade[],executions:LedgerInput[],notes:AnalyticsNote[]):AnalyticsReport{
 const noteMap=new Map(notes.map(note=>[note.cycleKey,note]));
 return summarizeAnalytics(trades.map(trade=>{
  const note=noteMap.get(trade.id);
  if(!note)return {trade,strategy:'Unreviewed',mistake:'Not reviewed',status:'missing' as const};
  if(note.fingerprint!==tradeFingerprint(trade,executions))
   return {trade,strategy:'Changed history',mistake:'Changed history',status:'stale' as const};
  return {trade,strategy:note.strategy.trim()||'No strategy set',
   mistake:note.mistakes.trim()?'Recorded' as const:'None recorded' as const,status:'verified' as const};
 }));
}
