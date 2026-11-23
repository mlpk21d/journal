'use server';
import {headers} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {loadReviewLedger} from '@/lib/review/server';
import {auditTrade} from '@/lib/review/details';
import {tradeFingerprint,validateJournalDraft,journalFields} from '@/lib/review/identity';
export type JournalSaveState={ok:boolean;message:string};
export async function saveTradeJournal(_previous:JournalSaveState,form:FormData):Promise<JournalSaveState>{
 try{
  const h=await headers(),host=h.get('host')??'',origin=h.get('origin');
  if(process.env.NODE_ENV!=='development'||!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host))
   return {ok:false,message:'Journal editing is restricted to localhost development.'};
  if(origin){
   let u:URL;try{u=new URL(origin);}catch{return {ok:false,message:'Invalid origin.'};}
   if(!['http:','https:'].includes(u.protocol)||u.host.toLowerCase()!==host.toLowerCase())
    return {ok:false,message:'Cross-origin request denied.'};
  }
  const key=String(form.get('cycleKey')??''),fingerprint=String(form.get('fingerprint')??'');
  if(!key||key.length>250||!/^[a-f0-9]{64}$/.test(fingerprint))
   return {ok:false,message:'Invalid trade reference. Refresh the page.'};
  const fields=Object.keys(journalFields);
  const draft=validateJournalDraft(Object.fromEntries(fields.map(k=>[k,form.get(k)])));
  const {entries}=await loadReviewLedger(null);
  const audit=auditTrade(entries,key);
  if(!audit)return {ok:false,message:'Completed trade no longer exists. Notes were not changed.'};
  const actual=tradeFingerprint(audit.trade,entries);
  if(actual!==fingerprint)return {ok:false,message:'Trade changed since loading. Refresh before saving.'};
  const r=await db().query(
   `INSERT INTO trade_journal_entries
   (cycle_key,fingerprint,account_id,symbol,direction,strategy,setup,entry_reason,exit_reason,mistakes,lessons,screenshot_url)
   VALUES($1,$2,$3::bigint,$4,$5,$6,$7,$8,$9,$10,$11,$12)
   ON CONFLICT(cycle_key) DO UPDATE SET
   strategy=EXCLUDED.strategy,setup=EXCLUDED.setup,entry_reason=EXCLUDED.entry_reason,
   exit_reason=EXCLUDED.exit_reason,mistakes=EXCLUDED.mistakes,lessons=EXCLUDED.lessons,
   screenshot_url=EXCLUDED.screenshot_url,updated_at=now()
   WHERE trade_journal_entries.fingerprint=EXCLUDED.fingerprint
   RETURNING id`,
   [key,actual,audit.trade.accountId,audit.trade.symbol,audit.trade.direction,
    draft.strategy,draft.setup,draft.entryReason,draft.exitReason,draft.mistakes,draft.lessons,draft.screenshotUrl]);
  if(!r.rowCount)return {ok:false,message:'Saved notes belong to a changed trade. Editing is blocked until reconciled.'};
  revalidatePath('/review/trade');revalidatePath('/review');
  return {ok:true,message:'Journal entry saved.'};
 }catch(e){
  const err=e as {code?:string;message?:string};
  console.error('[Trade journal] Save failed:',{code:err.code,message:err.message});
  if(err.code==='42P01')return {ok:false,message:'Run npm run db:migrate to apply migration 006.'};
  if(err.message?.startsWith('Invalid ')||err.message?.includes('exceeds ')||err.message?.startsWith('Screenshot '))
   return {ok:false,message:err.message};
  return {ok:false,message:'Unable to save journal entry. See server log.'};
 }
}
