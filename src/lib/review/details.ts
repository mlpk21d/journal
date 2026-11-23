import {buildLedger,parseFixed,formatFixed,type LedgerInput,type ClosedMatch} from '../performance/ledger.ts';
import {buildTradeReview,type ReviewedTrade} from './trade-review.ts';

export type TradeAudit={
 trade:ReviewedTrade;matches:ClosedMatch[];executions:LedgerInput[];
 gross:string;net:string|null;fees:string|null;
};
export type SessionAudit={
 accountId:string;date:string;symbol:string|null;
 matches:ClosedMatch[];executions:LedgerInput[];
 gross:string;net:string|null;fees:string|null;closedShares:string;
};
export const easternDate=(iso:string)=>new Intl.DateTimeFormat('en-CA',{
 timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date(iso));
const total=(amounts:string[])=>formatFixed(amounts.reduce((value,n)=>value+parseFixed(n),0n));
function amounts(matches:ClosedMatch[]){
 const gross=total(matches.map(m=>m.gross));
 const net=matches.every(m=>m.net!==null)?total(matches.map(m=>m.net!)):null;
 const fees=net===null?null:formatFixed(parseFixed(gross)-parseFixed(net));
 return {gross,net,fees};
}
function memberRows(input:LedgerInput[],matches:ClosedMatch[]){
 const ids=new Set(matches.flatMap(m=>[m.buyId,m.sellId]));
 return input.filter(row=>ids.has(row.id)).sort((a,b)=>a.executedAt.localeCompare(b.executedAt)||a.id.localeCompare(b.id));
}
/** Audit views never recalculate financial values; all realized numbers are
 * taken from the unchanged FIFO ledger match output.
 */
export function auditTrade(input:LedgerInput[],id:string):TradeAudit|null{
 const trade=buildTradeReview(input).trades.find(t=>t.id===id);
 if(!trade)return null;
 const buyIds=new Set(trade.direction==='LONG'?trade.entryIds:trade.exitIds);
 const sellIds=new Set(trade.direction==='LONG'?trade.exitIds:trade.entryIds);
 const matches=buildLedger(input).matches.filter(m=>
  m.accountId===trade.accountId&&m.symbol===trade.symbol&&m.direction===trade.direction&&
  buyIds.has(m.buyId)&&sellIds.has(m.sellId));
 if(!matches.length)throw new Error('Trade is missing FIFO matches');
 const sums=amounts(matches);
 if(sums.gross!==trade.gross||sums.net!==trade.net)throw new Error('Trade audit does not reconcile');
 return {trade,matches,executions:memberRows(input,matches),...sums};
}
export function auditSession(input:LedgerInput[],accountId:string,date:string,symbol?:string):SessionAudit|null{
 const report=buildTradeReview(input);
 const session=report.sessions.find(s=>s.accountId===accountId&&s.date===date);
 if(!session)return null;
 const matches=buildLedger(input).matches.filter(m=>m.accountId===accountId&&
  easternDate(m.closedAt)===date&&(!symbol||m.symbol===symbol));
 if(!matches.length)return null;
 const sums=amounts(matches),closedShares=total(matches.map(m=>m.quantity));
 if(!symbol&&(sums.gross!==session.gross||sums.net!==session.net||closedShares!==session.closedShares))
  throw new Error('Session audit does not reconcile');
 return {accountId,date,symbol:symbol??null,matches,executions:memberRows(input,matches),
  closedShares,...sums};
}
