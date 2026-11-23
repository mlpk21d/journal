import {formatFixed,parseFixed} from '../performance/ledger.ts';
import type {ReviewSession} from './trade-review.ts';
export type DailyPoint={
 date:string;gross:string;net:string|null;fees:string|null;
 accounts:number;closures:number;shares:string;symbols:string[];
 knownNetSubtotal:string;complete:boolean;
};
export type DailySummary={
 days:DailyPoint[];activeDays:number;verifiedDays:number;unverifiedDays:number;
 wins:number;losses:number;flat:number;netSubtotal:string;
 bestDay:DailyPoint|null;worstDay:DailyPoint|null;
 longestWinningStreak:number;longestLosingStreak:number;
 currentWinningStreak:number;currentLosingStreak:number;
};
const sum=(values:string[])=>formatFixed(values.reduce((n,v)=>n+parseFixed(v),0n));
/** Daily realized exit results by Eastern Time calendar date.
 * The incomplete days NEVER report net=0 or participate in streaks.
 * knownNetSubtotal is explicitly a subtotal of completely verified days, not an account equity curve.
 */
export function summarizeDailySessions(sessions:ReviewSession[]):DailySummary{
 const groups=new Map<string,ReviewSession[]>();
 for(const session of sessions){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(session.date))throw new Error('Invalid daily session date');
  const group=groups.get(session.date)??[];
  group.push(session);groups.set(session.date,group);
 }
 const days:DailyPoint[]=[];
 let total=0n,wins=0,losses=0,flat=0,winning=0,losing=0,maxWinning=0,maxLosing=0;
 let bestDay:DailyPoint|null=null,worstDay:DailyPoint|null=null;
 for(const [date,parts] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
  const complete=parts.every(p=>p.net!==null);
  const gross=sum(parts.map(p=>p.gross));
  const net=complete?sum(parts.map(p=>p.net!)):null;
  const fees=net===null?null:formatFixed(parseFixed(gross)-parseFixed(net));
  if(net!==null){
   total+=parseFixed(net);
   const amount=parseFixed(net);
   if(amount>0n){wins++;winning++;losing=0;}
   else if(amount<0n){losses++;losing++;winning=0;}
   else{flat++;winning=0;losing=0;}
   maxWinning=Math.max(maxWinning,winning);maxLosing=Math.max(maxLosing,losing);
  }else{winning=0;losing=0;}
  const point:DailyPoint={date,gross,net,fees,complete,
   accounts:new Set(parts.map(p=>p.accountId)).size,
   closures:parts.reduce((n,p)=>n+p.closureCount,0),
   shares:sum(parts.map(p=>p.closedShares)),symbols:[...new Set(parts.flatMap(p=>p.symbols))].sort(),
   knownNetSubtotal:formatFixed(total)};
  days.push(point);
  if(net!==null){
   if(!bestDay||parseFixed(net)>parseFixed(bestDay.net!))bestDay=point;
   if(!worstDay||parseFixed(net)<parseFixed(worstDay.net!))worstDay=point;
  }
 }
 return {days,activeDays:days.length,verifiedDays:wins+losses+flat,
  unverifiedDays:days.length-wins-losses-flat,wins,losses,flat,
  netSubtotal:formatFixed(total),bestDay,worstDay,
  longestWinningStreak:maxWinning,longestLosingStreak:maxLosing,
  currentWinningStreak:winning,currentLosingStreak:losing};
}
export function calendarCells(month:string,days:DailyPoint[]){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Invalid calendar month');
 const [y,m]=month.split('-').map(Number);
 const start=new Date(Date.UTC(y,m-1,1));
 const count=new Date(Date.UTC(y,m,0)).getUTCDate();
 const result:(DailyPoint|null)[]=Array(start.getUTCDay()).fill(null);
 const lookup=new Map(days.map(d=>[d.date,d]));
 for(let day=1;day<=count;day++){
  const date=month+'-'+String(day).padStart(2,'0');
  result.push(lookup.get(date)??{date,gross:'0',net:null,fees:null,complete:false,
   accounts:0,closures:0,shares:'0',symbols:[],knownNetSubtotal:'0'});
 }
 return result;
}
