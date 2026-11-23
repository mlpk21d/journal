import {buildLedger,formatFixed,parseFixed,type LedgerInput,type ClosedMatch} from '../performance/ledger';

export type ReviewedTrade={
 id:string;accountId:string;symbol:string;direction:'LONG'|'SHORT';
 quantity:string;entryPrice:string;exitPrice:string;enteredAt:string;exitedAt:string;
 durationMs:number;gross:string;fees:string|null;net:string|null;
 entryIds:string[];exitIds:string[];matchCount:number;
};
export type ReviewSession={
 date:string;accountId:string;gross:string;fees:string|null;net:string|null;
 closedShares:string;closureCount:number;symbols:string[];
};
export type ReviewResult={trades:ReviewedTrade[];sessions:ReviewSession[];openPositions:ReturnType<typeof buildLedger>['openPositions']};
type Cycle={id:string;accountId:string;symbol:string;direction:'LONG'|'SHORT';openedAt:string;matches:ClosedMatch[]};
const min=(a:bigint,b:bigint)=>a<b?a:b;
const money=(qty:bigint,price:bigint)=>qty*price/100000000n;
const dateET=(iso:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
const sum=(values:string[])=>formatFixed(values.reduce((s,v)=>s+parseFixed(v),0n));
const netSum=(matches:ClosedMatch[])=>matches.every(m=>m.net!==null)?sum(matches.map(m=>m.net!)):null;
const feeTotal=(gross:string,net:string|null)=>net===null?null:formatFixed(parseFixed(gross)-parseFixed(net));
function closeCycle(cycle:Cycle,byId:Map<string,LedgerInput>):ReviewedTrade|null{
 if(!cycle.matches.length)return null;
 const qty=cycle.matches.reduce((n,m)=>n+parseFixed(m.quantity),0n);
 let entryValue=0n,exitValue=0n;
 const entries=new Set<string>(),exits=new Set<string>();
 let enteredAt='',exitedAt='';
 for(const m of cycle.matches){
  const entryId=m.direction==='LONG'?m.buyId:m.sellId;
  const exitId=m.direction==='LONG'?m.sellId:m.buyId;
  const entry=byId.get(entryId),exit=byId.get(exitId);
  if(!entry||!exit)throw new Error('Missing FIFO match input');
  const q=parseFixed(m.quantity);
  entryValue+=money(q,parseFixed(entry.price));
  exitValue+=money(q,parseFixed(exit.price));
  entries.add(entryId);exits.add(exitId);
  if(!enteredAt||entry.executedAt<enteredAt)enteredAt=entry.executedAt;
  if(!exitedAt||exit.executedAt>exitedAt)exitedAt=exit.executedAt;
 }
 const gross=sum(cycle.matches.map(m=>m.gross));
 const net=netSum(cycle.matches);
 return {id:cycle.id,accountId:cycle.accountId,symbol:cycle.symbol,direction:cycle.direction,
  quantity:formatFixed(qty),entryPrice:formatFixed(entryValue*100000000n/qty),
  exitPrice:formatFixed(exitValue*100000000n/qty),enteredAt,exitedAt,
  durationMs:Math.max(0,Date.parse(exitedAt)-Date.parse(enteredAt)),
  gross,net,fees:feeTotal(gross,net),entryIds:[...entries],exitIds:[...exits],matchCount:cycle.matches.length};
}
/** Read-only projection over the exact FIFO matches used by /performance.
 * A trade finishes only when signed inventory returns to zero or reverses.
 * Session totals include partial realized exits even if inventory stays open.
 */
export function buildTradeReview(input:LedgerInput[]):ReviewResult{
 const ordered=[...input].sort((a,b)=>a.executedAt.localeCompare(b.executedAt)||a.id.localeCompare(b.id));
 const ledger=buildLedger(ordered);
 const byId=new Map(ordered.map(r=>[r.id,r]));
 if(byId.size!==ordered.length)throw new Error('Duplicate execution IDs');
 const closures=new Map<string,ClosedMatch[]>();
 for(const m of ledger.matches){
  const exit=m.direction==='LONG'?m.sellId:m.buyId;
  const key=m.accountId+'\0'+m.symbol+'\0'+exit;
  const list=closures.get(key)??[];list.push(m);closures.set(key,list);
 }
 const positions=new Map<string,{balance:bigint;cycle:Cycle|null}>();
 const trades:ReviewedTrade[]=[];
 for(const row of ordered){
  const key=row.accountId+'\0'+row.symbol;
  const state=positions.get(key)??{balance:0n,cycle:null};
  const qty=parseFixed(row.quantity)*(row.side==='BUY'?1n:-1n);
  const matched=closures.get(key+'\0'+row.id)??[];
  if(state.cycle&&matched.length)state.cycle.matches.push(...matched);
  const next=state.balance+qty;
  const reversed=state.balance!==0n&&next!==0n&&((state.balance>0n)!==(next>0n));
  if((next===0n||reversed)&&state.cycle){
   const complete=closeCycle(state.cycle,byId);if(complete)trades.push(complete);
   state.cycle=null;
  }
  if(next!==0n&&!state.cycle){
   const direction=next>0n?'LONG':'SHORT';
   state.cycle={id:row.accountId+':'+row.symbol+':'+row.id+':'+direction,
    accountId:row.accountId,symbol:row.symbol,direction,openedAt:row.executedAt,matches:[]};
  }
  state.balance=next;
  positions.set(key,state);
 }
 const perSession=new Map<string,ClosedMatch[]>();
 for(const match of ledger.matches){
  const date=dateET(match.closedAt);
  const key=match.accountId+'\0'+date;
  const list=perSession.get(key)??[];list.push(match);perSession.set(key,list);
 }
 const sessions=[...perSession.entries()].map(([key,matches]):ReviewSession=>{
  const [accountId,date]=key.split('\0');
  const gross=sum(matches.map(m=>m.gross)),net=netSum(matches);
  return {accountId,date,gross,net,fees:feeTotal(gross,net),
   closedShares:sum(matches.map(m=>m.quantity)),closureCount:matches.length,
   symbols:[...new Set(matches.map(m=>m.symbol))].sort()};
 }).sort((a,b)=>b.date.localeCompare(a.date)||a.accountId.localeCompare(b.accountId));
 return {trades:trades.sort((a,b)=>b.exitedAt.localeCompare(a.exitedAt)||a.id.localeCompare(b.id)),
  sessions,openPositions:ledger.openPositions};
}
