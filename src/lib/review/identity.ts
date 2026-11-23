import {createHash} from 'node:crypto';
import type {LedgerInput} from '../performance/ledger.ts';
import type {ReviewedTrade} from './trade-review.ts';
export function tradeFingerprint(trade:ReviewedTrade,input:LedgerInput[]):string{
 const ids=new Set([...trade.entryIds,...trade.exitIds]);
 const rows=input.filter(r=>ids.has(r.id)).sort((a,b)=>a.id.localeCompare(b.id));
 if(rows.length!==ids.size)throw new Error('Incomplete trade identity');
 return createHash('sha256').update(JSON.stringify({
  account:trade.accountId,symbol:trade.symbol,direction:trade.direction,
  quantity:trade.quantity,enteredAt:trade.enteredAt,exitedAt:trade.exitedAt,
  entryPrice:trade.entryPrice,exitPrice:trade.exitPrice,gross:trade.gross,net:trade.net,
  executions:rows.map(r=>[r.id,r.accountId,r.symbol,r.side,r.quantity,r.price,r.executedAt,r.fees,r.feeKnown])
 })).digest('hex');
}
export const journalFields={
 strategy:120,setup:2000,entryReason:5000,exitReason:5000,mistakes:2000,lessons:5000,screenshotUrl:1500
} as const;
export type JournalDraft={ [K in keyof typeof journalFields]:string };
export function validateJournalDraft(values:Record<string,unknown>):JournalDraft{
 const result={} as JournalDraft;
 for(const [key,max] of Object.entries(journalFields)){
  const value=values[key];
  if(typeof value!=='string')throw new Error('Invalid '+key);
  const s=value.trim();
  if(s.length>max)throw new Error(key+' exceeds '+max+' characters');
  (result as unknown as Record<string,string>)[key]=s;
 }
 if(result.screenshotUrl){
  let u:URL;try{u=new URL(result.screenshotUrl);}catch{throw new Error('Screenshot must be a valid HTTPS URL');}
  if(u.protocol!=='https:'||!u.hostname||u.username||u.password)throw new Error('Screenshot must be an HTTPS URL without credentials');
 }
 return result;
}
