import Link from 'next/link';
import {reviewIsLocal,loadReviewLedger} from '@/lib/review/server';
import {auditTrade} from '@/lib/review/details';
import {ReviewMatchTable,ReviewExecutionTable,ReviewTotals} from '@/components/review-audit';
import {tradeFingerprint} from '@/lib/review/identity';
import {getJournal,type StoredJournal} from '@/lib/review/journal-store';
import {TradeJournalEditor} from '@/components/trade-journal-editor';
export const dynamic='force-dynamic';
export default async function TradeAuditPage({searchParams}:{searchParams:Promise<{id?:string}>}){
 if(!await reviewIsLocal())return <main className="shell"><p className="notice">Trade audit is restricted to local development.</p></main>;
 const {id}=await searchParams;
 if(!id||id.length>250)return <main className="shell"><p className="notice">Invalid trade ID.</p><Link href="/review">Back to reviews</Link></main>;
 let audit:ReturnType<typeof auditTrade>|null=null,label='',error='',fingerprint='';
 let journal:StoredJournal|null=null;
 try{
  const {entries,accountLabel}=await loadReviewLedger(null);
  audit=auditTrade(entries,id);if(audit){label=accountLabel(audit.trade.accountId);fingerprint=tradeFingerprint(audit.trade,entries);journal=await getJournal(id);}
 }catch(e){console.error('[Review] Trade audit failed:',e);error='Unable to load the trade audit. Check the server log or 20,000-row history limit.';}
 return <main className="shell"><header><Link href="/" className="brand">TRADE / JOURNAL</Link><span className="muted">Read-only FIFO audit</span></header>
  <section className="page-title"><p className="eyebrow">TRADE REVIEW / DETAIL</p><h1>{audit?audit.trade.symbol+' · '+audit.trade.direction:'Trade details'}</h1>
   <p className="intro">Inspect the source orders and individual FIFO lot closures used to construct this completed trade. No imported transactions are modified.</p></section>
  <nav className="pill-row"><Link href="/review">← All reviews</Link><Link href="/performance">Performance ↗</Link></nav>
  {error?<p className="notice">{error}</p>:!audit?<p className="notice">This completed trade was not found. Its provisional ID may change when earlier history is imported or manual trades are edited.</p>:<>
   <p className="helper">Account: {label} · Entry: {audit.trade.enteredAt.replace('T',' ').slice(0,19)} UTC · Exit: {audit.trade.exitedAt.replace('T',' ').slice(0,19)} UTC · Quantity: {audit.trade.quantity} · Avg entry: {audit.trade.entryPrice} · Avg exit: {audit.trade.exitPrice}</p>
   <ReviewTotals gross={audit.gross} fees={audit.fees} net={audit.net} />
   {journal&&journal.fingerprint!==fingerprint?<p className="notice" role="alert">This trade changed since its journal entry was created. Saved notes (ID: {journal.id}) are preserved but are not attached to the revised trade. Journal editing is blocked pending manual reconciliation.</p>:<TradeJournalEditor cycleKey={audit.trade.id} fingerprint={fingerprint} journal={journal}/>}
   <h2>FIFO realized matches</h2><ReviewMatchTable matches={audit.matches}/>
   <h2>Participating executions</h2><ReviewExecutionTable executions={audit.executions}/>
   <p className="notice">Raw order fees are displayed per execution, not per individual lot match. The calculated fee total above reflects the FIFO engine’s allocation to matched shares. An order may include shares allocated to another cycle after a reversal.</p>
  </>}
 </main>;
}
