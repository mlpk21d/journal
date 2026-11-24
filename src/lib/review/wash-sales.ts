import {buildLedger,parseFixed,formatFixed,type LedgerInput} from '../performance/ledger.ts';

export type WashAccount={id:string;label:string;type:string|null};
export type WashCandidate={
 saleId:string;purchaseId:string;symbol:string;saleAccountId:string;purchaseAccountId:string;
 saleDate:string;purchaseDate:string;daysFromSale:number;lossShares:string;matchedShares:string;
 estimatedDisallowed:string;lossNet:string;crossAccount:boolean;retirementAccount:boolean;
 pendingWindow:boolean;
};
export type WashScreen={
 candidates:WashCandidate[];
 reviewedLongLossMatches:number;unmatchedLongLossMatches:number;
 shortLossMatches:number;unknownNetMatches:number;
 potentialDisallowed:string;crossAccountCount:number;retirementCount:number;
 pendingCount:number;openWindowLosses:number;asOf:string;
};
type OpenLot={id:string;remaining:bigint};
type Order={id:string;accountId:string;symbol:string;date:string;opened:bigint;side:'BUY'|'SELL';timestamp:string};
const min=(a:bigint,b:bigint)=>a<b?a:b;
const etDate=(iso:string)=>{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(iso));
 const part=(type:string)=>parts.find(p=>p.type===type)?.value??'';
 return part('year')+'-'+part('month')+'-'+part('day');
};
const dayNumber=(d:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d))throw new Error('Invalid wash sale date');
 const [y,m,day]=d.split('-').map(Number);
 return Date.UTC(y,m-1,day)/86400000;
};
const retirement=(type:string|null)=>/\b(IRA|ROTH|RETIREMENT|401\s?K|SEP|SIMPLE)\b/i.test(type??'');
/** Screening only: identical symbols in supplied accounts, loss-making LONG FIFO
 * matches, purchases within +/- 30 Eastern calendar days. It DOES NOT mutate
 * original FIFO P&L, create adjusted tax lots or claim Form 8949 correctness.
 *
 * Before-sale purchases must still be held AFTER the loss sale; buy shares
 * consumed closing shorts cannot serve as replacement opening long shares.
 */
export function screenWashSales(input:LedgerInput[],accounts:WashAccount[],asOf:string):WashScreen{
 const today=dayNumber(asOf);
 const ordered=[...input].sort((a,b)=>a.executedAt.localeCompare(b.executedAt)||a.id.localeCompare(b.id));
 const inventory=new Map<string,{side:'LONG'|'SHORT';lots:OpenLot[]}>();
 const openings:Order[]=[];
 const heldAtSale=new Map<string,Map<string,bigint>>();
 for(const trade of ordered){
  const key=trade.accountId+'\0'+trade.symbol;
  let current=inventory.get(key);
  if(!current){current={side:trade.side==='BUY'?'LONG':'SHORT',lots:[]};inventory.set(key,current);}
  let remaining=parseFixed(trade.quantity);
  if(remaining<=0n)throw new Error('Invalid share quantity');
  const incoming=trade.side==='BUY'?'LONG':'SHORT';
  if(current.side!==incoming){
   while(remaining>0n&&current.lots.length){
    const first=current.lots[0],matched=min(remaining,first.remaining);
    first.remaining-=matched;remaining-=matched;
    if(first.remaining===0n)current.lots.shift();
   }
   if(current.lots.length===0)current.side=incoming;
  }
  if(remaining>0n){
   current.side=incoming;
   current.lots.push({id:trade.id,remaining});
   if(incoming==='LONG')openings.push({
    id:trade.id,accountId:trade.accountId,symbol:trade.symbol,date:etDate(trade.executedAt),
    opened:remaining,side:trade.side,timestamp:trade.executedAt
   });
  }
  // An execution may close several FIFO long lots; all need the post-sale snapshot.
  if(trade.side==='SELL'){
   const holdings=new Map<string,bigint>();
   for(const [k,state] of inventory){
    if(state.side!=='LONG'||!k.endsWith('\0'+trade.symbol))continue;
    for(const lot of state.lots)holdings.set(lot.id,(holdings.get(lot.id)??0n)+lot.remaining);
   }
   heldAtSale.set(trade.id,holdings);
  }
 }
 const matches=buildLedger(ordered).matches;
 const byAccount=new Map(accounts.map(a=>[a.id,a]));
 const claimed=new Map<string,bigint>();
 const candidates:WashCandidate[]=[];
 let reviewedLongLossMatches=0,unmatchedLongLossMatches=0,shortLossMatches=0,unknownNetMatches=0;
 let potential=0n,openWindowLosses=0;
 for(const match of matches){
  if(match.net===null){unknownNetMatches++;continue;}
  if(parseFixed(match.net)>=0n)continue;
  if(match.direction!=='LONG'){shortLossMatches++;continue;}
  reviewedLongLossMatches++;
  if(today<dayNumber(etDate(match.closedAt))+30)openWindowLosses++;
  let toMatch=parseFixed(match.quantity);
  const saleDate=etDate(match.closedAt),saleDay=dayNumber(saleDate);
  const lossPerShare=parseFixed(match.net); // negative net P&L across matched shares
  const saleId=match.sellId;
  const replacements=openings.filter(buy=>{
   const offset=dayNumber(buy.date)-saleDay;
   return buy.symbol===match.symbol&&Math.abs(offset)<=30&&
    buy.id!==saleId;
  }).sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.id.localeCompare(b.id));
  for(const buy of replacements){
   if(toMatch<=0n)break;
   const days=dayNumber(buy.date)-saleDay;
   const held=heldAtSale.get(saleId)?.get(buy.id)??0n;
   // Prior purchases sold by this disposition cannot replace those shares.
   if(buy.timestamp<=match.closedAt&&held===0n)continue;
   const capacity=buy.timestamp<=match.closedAt?min(held,buy.opened):buy.opened;
   const available=capacity-(claimed.get(buy.id)??0n);
   if(available<=0n)continue;
   const qty=min(toMatch,available);
   const amount=(-lossPerShare)*qty/parseFixed(match.quantity);
   if(amount<=0n)continue;
   claimed.set(buy.id,(claimed.get(buy.id)??0n)+qty);
   toMatch-=qty;potential+=amount;
   const buyerType=byAccount.get(buy.accountId)?.type??null;
   candidates.push({saleId,purchaseId:buy.id,symbol:match.symbol,
    saleAccountId:match.accountId,purchaseAccountId:buy.accountId,
    saleDate,purchaseDate:buy.date,daysFromSale:days,
    lossShares:match.quantity,matchedShares:formatFixed(qty),
    estimatedDisallowed:formatFixed(amount),lossNet:match.net,
    crossAccount:match.accountId!==buy.accountId,retirementAccount:retirement(buyerType),
    pendingWindow:today<saleDay+30
   });
  }
  if(toMatch>0n)unmatchedLongLossMatches++;
 }
 return {candidates,reviewedLongLossMatches,unmatchedLongLossMatches,
  shortLossMatches,unknownNetMatches,potentialDisallowed:formatFixed(potential),
  crossAccountCount:candidates.filter(c=>c.crossAccount).length,
  retirementCount:candidates.filter(c=>c.retirementAccount).length,
  pendingCount:candidates.filter(c=>c.pendingWindow).length,openWindowLosses,asOf};
}
