import {parseFixed,formatFixed} from '../performance/ledger.ts';
import type {ReviewedTrade} from './trade-review.ts';

export type RiskPoint={id:string;symbol:string;exitedAt:string;net:string|null;knownSubtotal:string;segment:number;segmentNet:string|null};
export type DurationGroup={key:string;label:string;trades:number;verified:number;wins:number;losses:number;flat:number;net:string;average:string|null;winRate:number|null};
export type RiskReport={trades:number;verified:number;unverified:number;wins:number;losses:number;flat:number;
 averageWinner:string|null;averageLoser:string|null;payoffRatio:number|null;averageNet:string|null;verifiedNetSubtotal:string;
 longestLosingStreak:number;currentLosingStreak:number;maxVerifiedSegmentDrawdown:string|null;
 largestWinner:string|null;largestLoser:string|null;largestWinnerShare:number|null;
 points:RiskPoint[];durations:DurationGroup[]};
export const DURATION_BUCKETS=[
 {key:'0-5',label:'Under 5 minutes',max:300000},
 {key:'5-15',label:'5–15 minutes',max:900000},
 {key:'15-60',label:'15–60 minutes',max:3600000},
 {key:'60-240',label:'1–4 hours',max:14400000},
 {key:'240-1440',label:'4–24 hours',max:86400000},
 {key:'1440+',label:'24 hours or more',max:Infinity}
] as const;
const avg=(n:bigint,count:number)=>count?formatFixed(n/BigInt(count)):null;
/** Drawdown is calculated only inside uninterrupted sequences of known net results.
 * Missing values reset the segment's peak and the losing streak; they are not zero.
 */
export function buildRiskReport(trades:ReviewedTrade[]):RiskReport{
 const ordered=[...trades].sort((a,b)=>a.exitedAt.localeCompare(b.exitedAt)||a.id.localeCompare(b.id));
 let wins=0,losses=0,flat=0,unverified=0,winTotal=0n,lossAbs=0n,netTotal=0n;
 let biggestWin:bigint|null=null,biggestLoss:bigint|null=null;
 let streak=0,longest=0,peak=0n,segmentNet=0n,maxDrawdown=0n,segment=0;
 const points:RiskPoint[]=[];
 const buckets=new Map<string,ReviewedTrade[]>();
 for(const trade of ordered){
  const duration=trade.durationMs;
  if(!Number.isFinite(duration)||duration<0)throw new Error('Invalid trade duration');
  const category=DURATION_BUCKETS.find(b=>duration<b.max)!;
  const list=buckets.get(category.key)??[];list.push(trade);buckets.set(category.key,list);
  if(trade.net===null){
   unverified++;streak=0;segment++;segmentNet=0n;peak=0n;
   points.push({id:trade.id,symbol:trade.symbol,exitedAt:trade.exitedAt,net:null,
    knownSubtotal:formatFixed(netTotal),segment,segmentNet:null});
   continue;
  }
  const value=parseFixed(trade.net);netTotal+=value;segmentNet+=value;
  if(value>0n){wins++;winTotal+=value;streak=0;if(biggestWin===null||value>biggestWin)biggestWin=value;}
  else if(value<0n){losses++;lossAbs-=value;streak++;longest=Math.max(longest,streak);
   if(biggestLoss===null||value<biggestLoss)biggestLoss=value;}
  else{flat++;streak=0;}
  if(segmentNet>peak)peak=segmentNet;
  const drawdown=peak-segmentNet;if(drawdown>maxDrawdown)maxDrawdown=drawdown;
  points.push({id:trade.id,symbol:trade.symbol,exitedAt:trade.exitedAt,net:trade.net,
   knownSubtotal:formatFixed(netTotal),segment,segmentNet:formatFixed(segmentNet)});
 }
 const durations:DurationGroup[]=DURATION_BUCKETS.map(category=>{
  const list=buckets.get(category.key)??[];
  let verified=0,w=0,l=0,f=0,total=0n;
  for(const t of list){
   if(t.net===null)continue;
   verified++;const n=parseFixed(t.net);total+=n;
   if(n>0n)w++;else if(n<0n)l++;else f++;
  }
  return {key:category.key,label:category.label,trades:list.length,verified,wins:w,losses:l,flat:f,
   net:formatFixed(total),average:avg(total,verified),winRate:verified?w/verified*100:null};
 });
 return {trades:ordered.length,verified:wins+losses+flat,unverified,wins,losses,flat,
  averageWinner:avg(winTotal,wins),averageLoser:avg(-lossAbs,losses),
  payoffRatio:wins&&losses?Number(winTotal)*losses/(Number(lossAbs)*wins):null,
  averageNet:avg(netTotal,wins+losses+flat),verifiedNetSubtotal:formatFixed(netTotal),
  longestLosingStreak:longest,currentLosingStreak:streak,
  maxVerifiedSegmentDrawdown:wins+losses+flat?formatFixed(maxDrawdown):null,
  largestWinner:biggestWin===null?null:formatFixed(biggestWin),
  largestLoser:biggestLoss===null?null:formatFixed(biggestLoss),
  largestWinnerShare:winTotal>0n&&biggestWin!==null?Number(biggestWin)/Number(winTotal)*100:null,
  points,durations};
}
