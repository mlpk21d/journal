/** Provisional FIFO matching for imported, fully-filled stock order snapshots.
 * This is performance accounting, not a tax-lot or wash-sale engine.
 * Money and shares use eight fixed decimal places to avoid floating-point drift.
 */
export type LedgerInput={
 id:string;accountId:string;symbol:string;side:'BUY'|'SELL';quantity:string;price:string;
 executedAt:string;fees:string|null;feeKnown:boolean;
};
export type ClosedMatch={
 accountId:string;symbol:string;buyId:string;sellId:string;
 closedAt:string;quantity:string;gross:string;net:string|null;
};
export type LedgerResult={
 matches:ClosedMatch[];openPositions:{accountId:string;symbol:string;quantity:string;basis:string;feeKnown:boolean}[];
 unmatchedSales:{accountId:string;symbol:string;sellId:string;quantity:string;closedAt:string}[];
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
type Lot={id:string;remaining:bigint;price:bigint;feeRemaining:bigint|null};
export function buildLedger(input:LedgerInput[]):LedgerResult{
 const ordered=[...input].sort((a,b)=>a.executedAt.localeCompare(b.executedAt)||a.id.localeCompare(b.id));
 const positions=new Map<string,Lot[]>();
 const info=new Map<string,{accountId:string;symbol:string}>();
 const matches:ClosedMatch[]=[];
 const unmatchedSales:LedgerResult['unmatchedSales']=[];
 let gross=0n,net=0n,netKnown=true,closedShares=0n;
 for(const row of ordered){
  const key=row.accountId+'\0'+row.symbol;
  const lots=positions.get(key)??[];
  positions.set(key,lots);info.set(key,{accountId:row.accountId,symbol:row.symbol});
  const qty=parseFixed(row.quantity),price=parseFixed(row.price);
  if(qty<=0n||price<0n)throw new Error('Invalid imported execution');
  const fee=row.feeKnown&&row.fees!==null?parseFixed(row.fees):null;
  if(fee!==null&&fee<0n)throw new Error('Invalid imported fee');
  if(row.side==='BUY'){
   lots.push({id:row.id,remaining:qty,price,feeRemaining:fee});
   continue;
  }
  let remaining=qty;
  let saleFeeRemaining=fee;
  while(remaining>0n && lots.length){
   const lot=lots[0];
   const matched=remaining<lot.remaining?remaining:lot.remaining;
   const buyCost=amount(matched,lot.price);
   const proceeds=amount(matched,price);
   const currentGross=proceeds-buyCost;
   gross+=currentGross;closedShares+=matched;
   // Allocate fees by proportional remaining shares, with the last match
   // consuming any rounding remainder (no repeated fee charging).
   const entryFee=lot.feeRemaining===null?null:matched===lot.remaining?lot.feeRemaining:lot.feeRemaining*matched/lot.remaining;
   const exitFee=saleFeeRemaining===null?null:matched===remaining?saleFeeRemaining:saleFeeRemaining*matched/remaining;
   const known=entryFee!==null&&exitFee!==null;
   const currentNet=known?currentGross-entryFee-exitFee:null;
   if(currentNet===null)netKnown=false;else net+=currentNet;
   matches.push({
    accountId:row.accountId,symbol:row.symbol,buyId:lot.id,sellId:row.id,
    closedAt:row.executedAt,quantity:formatFixed(matched),
    gross:formatFixed(currentGross),net:currentNet===null?null:formatFixed(currentNet)
   });
   if(lot.feeRemaining!==null&&entryFee!==null)lot.feeRemaining-=entryFee;
   if(saleFeeRemaining!==null&&exitFee!==null)saleFeeRemaining-=exitFee;
   lot.remaining-=matched;remaining-=matched;
   if(lot.remaining===0n)lots.shift();
  }
  if(remaining>0n){
   unmatchedSales.push({accountId:row.accountId,symbol:row.symbol,sellId:row.id,quantity:formatFixed(remaining),closedAt:row.executedAt});
   netKnown=false;
  }
 }
 const openPositions:LedgerResult['openPositions']=[];
 for(const [key,lots] of positions){
  if(!lots.length)continue;
  const details=info.get(key)!;
  openPositions.push({...details,quantity:formatFixed(lots.reduce((sum,lot)=>sum+lot.remaining,0n)),
   basis:formatFixed(lots.reduce((sum,lot)=>sum+amount(lot.remaining,lot.price),0n)),
   feeKnown:lots.every(lot=>lot.feeRemaining!==null)});
 }
 return {matches,openPositions,unmatchedSales,gross:formatFixed(gross),
  net:netKnown?formatFixed(net):null,netKnown,closedShares:formatFixed(closedShares)};
}
