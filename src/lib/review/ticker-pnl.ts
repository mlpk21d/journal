import {buildLedger,parseFixed,formatFixed,type LedgerInput,type ClosedMatch} from '../performance/ledger.ts';
import {buildTradeReview,type ReviewedTrade} from './trade-review.ts';
import {calculateMetrics,type AnalyticsTrade,type AnalyticsMetrics} from './analytics.ts';

export type TickerPnlRow={
 symbol:string;accounts:number;fifoClosures:number;closedShares:string;
 realizedGross:string;knownNet:string;knownGross:string;knownFees:string;
 unverifiedClosures:number;fullyVerified:boolean;
 completedTrades:number;verifiedCompleted:number;wins:number;losses:number;breakeven:number;
 winRate:number|null;averageTrade:string|null;profitFactor:number|null|'∞';
 openPositions:number;openQuantity:string;lastExit:string|null;
};
export type TickerPnlReport={
 rows:TickerPnlRow[];matches:ClosedMatch[];trades:ReviewedTrade[];
 symbols:number;knownNet:string;unknownClosures:number;complete:boolean;
};
export type TickerPnlFilters={from?:string;to?:string;symbol?:string};
const total=(values:string[])=>formatFixed(values.reduce((n,v)=>n+parseFixed(v),0n));
/** New York exchange-local date even when the runtime's timezone differs. */
export function exitDateET(iso:string):string{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(iso));
 const get=(type:string)=>parts.find(p=>p.type===type)?.value??'';
 return get('year')+'-'+get('month')+'-'+get('day');
}
const annotated=(trades:ReviewedTrade[]):AnalyticsTrade[]=>
 trades.map(trade=>({trade,strategy:'Unreviewed',mistake:'Not reviewed',status:'missing'}));
const metrics=(trades:ReviewedTrade[]):AnalyticsMetrics=>calculateMetrics(annotated(trades));
/** Construct FIFO from complete available account history BEFORE applying exit
 * dates. Realized net includes partial exits of positions still open. Completed
 * trade metrics are deliberately distinct, never summed into realized net.
 * A single unknown-fee closure means the ticker's entire net is unverified;
 * knownNet is explicitly only the subtotal of verified closures.
 */
export function buildTickerPnlReport(input:LedgerInput[],filters:TickerPnlFilters={}):TickerPnlReport{
 const ledger=buildLedger(input);
 const review=buildTradeReview(input);
 const matches=ledger.matches.filter(m=>
  (!filters.symbol||m.symbol.toUpperCase()===filters.symbol.toUpperCase())&&
  (!filters.from||exitDateET(m.closedAt)>=filters.from)&&
  (!filters.to||exitDateET(m.closedAt)<=filters.to));
 const trades=review.trades.filter(t=>
  (!filters.symbol||t.symbol.toUpperCase()===filters.symbol.toUpperCase())&&
  (!filters.from||exitDateET(t.exitedAt)>=filters.from)&&
  (!filters.to||exitDateET(t.exitedAt)<=filters.to));
 const symbols=new Set([
  ...matches.map(m=>m.symbol),
  ...trades.map(t=>t.symbol),
  ...ledger.openPositions.map(p=>p.symbol).filter(s=>!filters.symbol||s.toUpperCase()===filters.symbol.toUpperCase())
 ]);
 const rows:TickerPnlRow[]=[];
 for(const symbol of symbols){
  const items=matches.filter(m=>m.symbol===symbol);
  const completed=trades.filter(t=>t.symbol===symbol);
  const open=ledger.openPositions.filter(p=>p.symbol===symbol);
  const known=items.filter(m=>m.net!==null);
  const m=metrics(completed);
  const gross=total(items.map(x=>x.gross));
  const knownGross=total(known.map(x=>x.gross));
  const knownNet=total(known.map(x=>x.net!));
  const accountIds=new Set([...items.map(x=>x.accountId),...completed.map(x=>x.accountId),...open.map(x=>x.accountId)]);
  rows.push({
   symbol,accounts:accountIds.size,fifoClosures:items.length,
   closedShares:total(items.map(x=>x.quantity)),
   realizedGross:gross,knownGross,knownNet,
   knownFees:formatFixed(parseFixed(knownGross)-parseFixed(knownNet)),
   unverifiedClosures:items.length-known.length,fullyVerified:items.length===known.length,
   completedTrades:m.trades,verifiedCompleted:m.verified,
   wins:m.wins,losses:m.losses,breakeven:m.breakeven,
   winRate:m.winRate,averageTrade:m.average,profitFactor:m.profitFactor,
   openPositions:open.length,
   openQuantity:total(open.map(p=>p.quantity)),
   lastExit:items.length?items.map(x=>x.closedAt).sort().at(-1)!:null
  });
 }
 rows.sort((a,b)=>{
  const aa=parseFixed(a.knownNet),bb=parseFixed(b.knownNet);
  return aa===bb?a.symbol.localeCompare(b.symbol):aa>bb?-1:1;
 });
 return {rows,matches,trades,symbols:rows.length,
  knownNet:total(matches.filter(m=>m.net!==null).map(m=>m.net!)),
  unknownClosures:matches.filter(m=>m.net===null).length,
  complete:matches.every(m=>m.net!==null)};
}
