'use server';
import {reviewIsLocal,loadReviewLedger} from '@/lib/review/server';
import {auditTrade} from '@/lib/review/details';
import {tradeFingerprint} from '@/lib/review/identity';
import {getJournal,type StoredJournal} from '@/lib/review/journal-store';
import type {TradeAudit} from '@/lib/review/details';

export type TradeModalData={audit:TradeAudit;accountLabel:string;fingerprint:string;journal:StoredJournal|null};
export type TradeModalResponse={ok:true;data:TradeModalData}|{ok:false;message:string};

/** Called only after a user opens a trade on the Review page.
 * The browser never supplies source transactions, totals or a fingerprint.
 */
export async function loadTradeReviewModal(id:string):Promise<TradeModalResponse>{
 if(!await reviewIsLocal())return {ok:false,message:'Trade Review is available only on the local development server.'};
 if(typeof id!=='string'||!id||id.length>250)return {ok:false,message:'Invalid trade reference.'};
 try{
  const {entries,accountLabel}=await loadReviewLedger(null);
  const audit=auditTrade(entries,id);
  if(!audit)return {ok:false,message:'This completed trade is no longer available. Refresh Trade Review.'};
  const [journal,fingerprint]=await Promise.all([getJournal(id),Promise.resolve(tradeFingerprint(audit.trade,entries))]);
  return {ok:true,data:{audit,accountLabel:accountLabel(audit.trade.accountId),fingerprint,journal}};
 }catch(error){
  const err=error as {code?:string};
  console.error('[Trade Review modal] Failed to load:',{code:err.code,error});
  return {ok:false,message:err.code==='42P01'
   ?'Trade journal table is missing. Run npm run db:migrate.'
   :'Unable to load trade details. Check the Next.js terminal.'};
 }
}
