/** Provisional FIFO position ledger for fully-filled stock order snapshots.
 * Both long and short inventory are represented as signed lots. This is not
 * tax accounting: an opening SELL can be a genuine short or a sale of shares
 * acquired before the imported history began. Such cases are flagged.
 */
export type LedgerInput={
 id:string;accountId:string;symbol:string;side:'BUY'|'SELL';quantity:string;price:string;
 executedAt:string;fees:string|null;feeKnown:boolean;
};
export type ClosedMatch={
 accountId:string;symbol:string;buyId:string;sellId:string;direction:'LONG'|'SHORT';
 closedAt:string;quantity:string;gross:string;net:string|null;
};
export type LedgerResult={
 matches:ClosedMatch[];
 openPositions:{accountId:string;symbol:string;side:'LONG'|'SHORT';quantity:string;basis:string;feeKnown:boolean}[];
 /** An opening sell may be a true short OR a sale with missing earlier long history. */
 unverifiedOpeningSales:{accountId:string;symbol:string;sellId:string;quantity:string;openedAt:string}[];
 gross:string;net:string|null;netKnown:boolean;closedShares:string;
};
const SCALE=100000000n;
export function parseFixed(value:string):bigint{
 if(!/^-?\d+(?:\.\d{1,8})?$/.test(value))throw new Error('Invalid fixed decimal: '+value);
 const negative=value.startsWith('-');
 const raw=negative?value.slice(1):value;
 const [whole,part='']=raw.split('.');
 const n=BigInt(whole)*SCALE+BigInt(part.padEnd(8,'0'));
 return negative?-n:n;
}
export function formatFixed(value:bigint):string{
 const negative=value<0n;
 const a=negative?-value:value;
 const whole=a/SCALE;
 const remainder=(a%SCALE).toString().padStart(8,'0').replace(/0+$/,'');
 return (negative?'-':'')+whole.toString()+(remainder?'.'+remainder:'');
}
function amount(qty:bigint,price:bigint):bigint{return qty*price/SCALE;}
function min(a:bigint,b:bigint):bigint{return a<b?a:b;}
type Lot={id:string;side:'BUY'|'SELL';remaining:bigint;price:bigint;feeRemaining:bigint|null};
export function buildLedger(input:LedgerInput[]):LedgerResult{
 const ordered=[...input].sort((a,b)=>a.executedAt.localeCompare(b.executedAt)||a.id.localeCompare(b.id));
 const positions=new Map<string,Lot[]>();
 const info=new Map<string,{accountId:string;symbol:string}>();
 const matches:ClosedMatch[]=[];
 const unverifiedOpeningSales:LedgerResult['unverifiedOpeningSales']=[];
 let gross=0n,net=0n,netKnown=true,closedShares=0n;
 for(const row of ordered){
  const key=row.accountId+'\0'+row.symbol;
  const lots=positions.get(key)??[];
  positions.set(key,lots);info.set(key,{accountId:row.accountId,symbol:row.symbol});
  const qty=parseFixed(row.quantity),price=parseFixed(row.price);
  if(qty<=0n||price<0n)throw new Error('Invalid imported execution');
  let feeRemaining=row.feeKnown&&row.fees!==null?parseFixed(row.fees):null;
  if(feeRemaining!==null&&feeRemaining<0n)throw new Error('Invalid imported fee');
  let remaining=qty;
  // The opposite-side order closes existing inventory first. Any remainder
  // opens a new lot in the new direction, including a position reversal.
  while(remaining>0n&&lots.length&&lots[0].side!==row.side){
   const lot=lots[0];
   const matched=min(remaining,lot.remaining);
   const currentGross=lot.side==='BUY'
    ?amount(matched,price)-amount(matched,lot.price)
    :amount(matched,lot.price)-amount(matched,price);
   // Each order's fee is allocated once between closures and new inventory.
   // The last portion retains any integer rounding remainder.
   const entryFee=lot.feeRemaining===null?null:
    matched===lot.remaining?lot.feeRemaining:lot.feeRemaining*matched/lot.remaining;
   const exitFee=feeRemaining===null?null:
    matched===remaining?feeRemaining:feeRemaining*matched/remaining;
   const currentNet=entryFee===null||exitFee===null?null:currentGross-entryFee-exitFee;
   gross+=currentGross;closedShares+=matched;
   if(currentNet===null)netKnown=false;else net+=currentNet;
   matches.push({
    accountId:row.accountId,symbol:row.symbol,
    buyId:lot.side==='BUY'?lot.id:row.id,
    sellId:lot.side==='SELL'?lot.id:row.id,
    direction:lot.side==='BUY'?'LONG':'SHORT',
    closedAt:row.executedAt,quantity:formatFixed(matched),
    gross:formatFixed(currentGross),net:currentNet===null?null:formatFixed(currentNet)
   });
   if(lot.feeRemaining!==null&&entryFee!==null)lot.feeRemaining-=entryFee;
   if(feeRemaining!==null&&exitFee!==null)feeRemaining-=exitFee;
   lot.remaining-=matched;remaining-=matched;
   if(lot.remaining===0n)lots.shift();
  }
  if(remaining>0n){
   if(row.side==='SELL'&&lots.length===0){
    unverifiedOpeningSales.push({accountId:row.accountId,symbol:row.symbol,
     sellId:row.id,quantity:formatFixed(remaining),openedAt:row.executedAt});
   }
   lots.push({id:row.id,side:row.side,remaining,price,feeRemaining});
  }
 }
 const openPositions:LedgerResult['openPositions']=[];
 for(const [key,lots] of positions){
  if(!lots.length)continue;
  const details=info.get(key)!;
  const qty=lots.reduce((sum,lot)=>sum+(lot.side==='BUY'?lot.remaining:-lot.remaining),0n);
  if(qty===0n)continue;
  openPositions.push({...details,side:qty>0n?'LONG':'SHORT',quantity:formatFixed(qty),
   basis:formatFixed(lots.reduce((sum,lot)=>sum+amount(lot.remaining,lot.price),0n)),
   feeKnown:lots.every(lot=>lot.feeRemaining!==null)});
 }
 return {matches,openPositions,unverifiedOpeningSales,gross:formatFixed(gross),
  net:netKnown?formatFixed(net):null,netKnown,closedShares:formatFixed(closedShares)};
}
