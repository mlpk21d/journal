import {buildLedger,parseFixed,formatFixed,type LedgerInput} from '../performance/ledger.ts';

const scale=100000000n;
const value=(n:string)=>parseFixed(n);
const fmt=(n:bigint)=>formatFixed(n);
const min=(a:bigint,b:bigint)=>a<b?a:b;
const dateET=(iso:string)=>{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(iso));
 const field=(t:string)=>parts.find(p=>p.type===t)?.value??'';
 return field('year')+'-'+field('month')+'-'+field('day');
};
const day=(d:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d))throw new Error('Invalid tax date');
 const [y,m,n]=d.split('-').map(Number);
 return Date.UTC(y,m-1,n)/86400000;
};
export type TaxAccount={id:string;label:string;type:string|null};
export type BasisAdjustment={saleId:string;purchaseId:string;symbol:string;saleAccountId:string;
 purchaseAccountId:string;saleDate:string;purchaseDate:string;quantity:string;disallowed:string;
 treatment:'basis-carry'|'ira-permanent';inheritedHoldingStart:string};
export type TaxDisposition={id:string;saleId:string;buyId:string;accountId:string;symbol:string;
 closedAt:string;quantity:string;originalNet:string|null;basisIncrease:string;
 disallowed:string;estimatedTaxNet:string|null;flags:string[]};
export type AdjustedOpenLot={accountId:string;symbol:string;buyId:string;acquiredAt:string;quantity:string;
 originalBasis:string;basisIncrease:string;estimatedBasis:string;holdingStart:string|null};
export type TaxLotPreview={dispositions:TaxDisposition[];adjustments:BasisAdjustment[];
 openLots:AdjustedOpenLot[];knownOriginalNet:string;knownEstimatedTaxNet:string;
 openDeferredBasis:string;iraDisallowed:string;pendingWindows:number;unmatchedLosses:number;
 shortMatches:number;unknownNetMatches:number;retirementSourceMatches:number;asOf:string};
type Piece={buyId:string;accountId:string;symbol:string;acquiredAt:string;day:number;qty:bigint;
 consumedAt:string|null;closure:number|null;reserved:boolean;originalBasis:bigint;
 originalNet:bigint|null;carried:bigint;holdingStart:string|null};
const isIRA=(a:TaxAccount|undefined)=>/(^|[^A-Z])(IRA|ROTH|401K|401\(K\)|SEP|SIMPLE)([^A-Z]|$)/i.test(a?.type??'');

/** Read-only identical-symbol equity FIFO tax-lot preview. All accounts must be
 * supplied. This is NOT a reconciled tax return or substitute for 1099-B.
 *
 * Purchases used to cover shorts cannot be replacement long acquisitions.
 * Before-sale replacements must remain held after the losing sale.
 * Each attributed acquisition portion is reserved once, but its later adjusted
 * loss may be deferred again in a separate replacement (wash chain).
 */
export function buildTaxLotPreview(executions:LedgerInput[],accounts:TaxAccount[],asOf:string):TaxLotPreview{
 const today=day(asOf);
 const orders=[...executions].sort((a,b)=>a.executedAt.localeCompare(b.executedAt)||a.id.localeCompare(b.id));
 if(new Set(orders.map(o=>o.id)).size!==orders.length)throw new Error('Duplicate execution ID');
 const byId=new Map(orders.map(o=>[o.id,o]));
 const byAccount=new Map(accounts.map(a=>[a.id,a]));
 const matches=buildLedger(orders).matches;
 const shortCovers=new Map<string,bigint>();
 const longByBuy=new Map<string,number[]>();
 for(let i=0;i<matches.length;i++){
  const m=matches[i];
  if(m.direction==='SHORT')shortCovers.set(m.buyId,(shortCovers.get(m.buyId)??0n)+value(m.quantity));
  else{const list=longByBuy.get(m.buyId)??[];list.push(i);longByBuy.set(m.buyId,list);}
 }
 const pieces:Piece[]=[];
 const byClosure=new Map<number,Piece[]>();
 for(const buy of orders.filter(o=>o.side==='BUY')){
  let left=value(buy.quantity)-(shortCovers.get(buy.id)??0n);
  if(left<0n)throw new Error('Invalid short cover');
  const purchased=left;
  let basis=purchased*value(buy.price)/scale;
  for(const index of longByBuy.get(buy.id)??[]){
   const match=matches[index],qty=value(match.quantity);
   if(qty>left)throw new Error('Invalid FIFO acquisition');
   const partBasis=qty===left?basis:qty*value(buy.price)/scale;
   left-=qty;basis-=partBasis;
   const part:Piece={buyId:buy.id,accountId:buy.accountId,symbol:buy.symbol,
    acquiredAt:buy.executedAt,day:day(dateET(buy.executedAt)),qty,consumedAt:match.closedAt,closure:index,
    reserved:false,originalBasis:partBasis,originalNet:match.net===null?null:value(match.net),carried:0n,holdingStart:null};
   pieces.push(part);byClosure.set(index,[part]);
  }
  if(left>0n)pieces.push({buyId:buy.id,accountId:buy.accountId,symbol:buy.symbol,
   acquiredAt:buy.executedAt,day:day(dateET(buy.executedAt)),qty:left,consumedAt:null,closure:null,
   reserved:false,originalBasis:basis,originalNet:null,carried:0n,holdingStart:null});
 }
 const split=(part:Piece,qty:bigint)=>{
  if(qty===part.qty)return part;
  if(qty<=0n||qty>part.qty)throw new Error('Invalid wash portion');
  const total=part.qty;
  const basis=part.originalBasis*qty/total,carry=part.carried*qty/total;
  const net=part.originalNet===null?null:part.originalNet*qty/total;
  const other:Piece={...part,qty:total-qty,originalBasis:part.originalBasis-basis,
   originalNet:part.originalNet===null?null:part.originalNet-net!,carried:part.carried-carry};
  part.qty=qty;part.originalBasis=basis;part.originalNet=net;part.carried=carry;
  pieces.splice(pieces.indexOf(part)+1,0,other);
  if(part.closure!==null){
   const list=byClosure.get(part.closure)!;
   list.splice(list.indexOf(part)+1,0,other);
  }
  return part;
 };
 const adjustments:BasisAdjustment[]=[];
 const dispositions:TaxDisposition[]=[];
 let originalTotal=0n,taxTotal=0n,iraTotal=0n,pendingWindows=0,unmatchedLosses=0,shortMatches=0,unknownNetMatches=0,retirementSourceMatches=0;
 for(let i=0;i<matches.length;i++){
  const m=matches[i];
  if(m.direction==='SHORT'){shortMatches++;continue;}
  if(isIRA(byAccount.get(m.accountId))){
   retirementSourceMatches++;
   dispositions.push({id:String(i),saleId:m.sellId,buyId:m.buyId,accountId:m.accountId,
    symbol:m.symbol,closedAt:m.closedAt,quantity:m.quantity,originalNet:m.net,
    basisIncrease:'0',disallowed:'0',estimatedTaxNet:null,
    flags:['Retirement disposition — excluded from taxable net']});
   continue;
  }
  const matchParts=byClosure.get(i)??[];
  if(!matchParts.length)throw new Error('Missing FIFO purchase portions');
  let deferred=0n,basisIncrease=0n,hasLoss=false;
  const flags:string[]=[];
  const saleDay=day(dateET(m.closedAt));
  for(const sold of [...matchParts]){
   basisIncrease+=sold.carried;
   if(sold.originalNet===null)continue;
   const loss=sold.originalNet-sold.carried;
   if(loss>=0n)continue;
   hasLoss=true;
   let remaining=sold.qty,lossAvailable=-loss;
   const candidates=pieces.filter(b=>{
    if(b===sold||b.reserved||b.symbol!==sold.symbol||Math.abs(b.day-saleDay)>30)return false;
    return b.acquiredAt>m.closedAt||b.consumedAt===null||b.consumedAt>m.closedAt;
   }).sort((a,b)=>a.acquiredAt.localeCompare(b.acquiredAt)||a.buyId.localeCompare(b.buyId));
   for(const candidate of candidates){
    if(remaining===0n)break;
    const qty=min(remaining,candidate.qty);
    const attributable=qty===remaining?lossAvailable:(-loss)*qty/sold.qty;
    const buy=split(candidate,qty);
    buy.reserved=true;
    const ira=isIRA(byAccount.get(buy.accountId));
    if(ira)iraTotal+=attributable;
    else {
     buy.carried+=attributable;
     buy.holdingStart=sold.holdingStart??byId.get(sold.buyId)?.executedAt??null;
    }
    deferred+=attributable;lossAvailable-=attributable;remaining-=qty;
    if(ira&&!flags.includes('IRA / no basis increase'))flags.push('IRA / no basis increase');
    if(buy.accountId!==m.accountId&&!flags.includes('Cross-account'))flags.push('Cross-account');
    adjustments.push({saleId:m.sellId,purchaseId:buy.buyId,symbol:m.symbol,
     saleAccountId:m.accountId,purchaseAccountId:buy.accountId,saleDate:dateET(m.closedAt),
     purchaseDate:dateET(buy.acquiredAt),quantity:fmt(qty),disallowed:fmt(attributable),
     treatment:ira?'ira-permanent':'basis-carry',
     inheritedHoldingStart:sold.holdingStart??byId.get(sold.buyId)?.executedAt??m.closedAt});
   }
   if(remaining>0n)unmatchedLosses++;
  }
  if(hasLoss&&today<saleDay+30){pendingWindows++;flags.push('30-day window open');}
  if(m.net===null)unknownNetMatches++;
  else originalTotal+=value(m.net);
  const net=m.net===null?null:value(m.net)-basisIncrease+deferred;
  if(net!==null)taxTotal+=net;
  dispositions.push({id:String(i),saleId:m.sellId,buyId:m.buyId,accountId:m.accountId,symbol:m.symbol,
   closedAt:m.closedAt,quantity:m.quantity,originalNet:m.net,basisIncrease:fmt(basisIncrease),
   disallowed:fmt(deferred),estimatedTaxNet:net===null?null:fmt(net),flags});
 }
 const openLots:AdjustedOpenLot[]=pieces.filter(p=>p.closure===null).map(p=>({
  accountId:p.accountId,symbol:p.symbol,buyId:p.buyId,acquiredAt:p.acquiredAt,
  quantity:fmt(p.qty),originalBasis:fmt(p.originalBasis),basisIncrease:fmt(p.carried),
  estimatedBasis:fmt(p.originalBasis+p.carried),holdingStart:p.holdingStart
 })).sort((a,b)=>a.symbol.localeCompare(b.symbol)||a.acquiredAt.localeCompare(b.acquiredAt));
 return {dispositions,adjustments,openLots,knownOriginalNet:fmt(originalTotal),
  knownEstimatedTaxNet:fmt(taxTotal),openDeferredBasis:fmt(openLots.reduce((n,p)=>n+value(p.basisIncrease),0n)),
  iraDisallowed:fmt(iraTotal),pendingWindows,unmatchedLosses,shortMatches,unknownNetMatches,retirementSourceMatches,asOf};
}
