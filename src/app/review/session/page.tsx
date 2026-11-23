import Link from 'next/link';
import {reviewIsLocal,loadReviewLedger} from '@/lib/review/server';
import {auditSession} from '@/lib/review/details';
import {ReviewMatchTable,ReviewExecutionTable,ReviewTotals} from '@/components/review-audit';
export const dynamic='force-dynamic';
export default async function SessionAuditPage({searchParams}:{searchParams:Promise<{account?:string;date?:string;symbol?:string}>}){
 if(!await reviewIsLocal())return <main className="shell"><p className="notice">Session audit is restricted to local development.</p></main>;
 const p=await searchParams;
 const account=typeof p.account==='string'?p.account:'';
 const date=typeof p.date==='string'?p.date:'';
 const symbol=typeof p.symbol==='string'?p.symbol.toUpperCase():'';
 const valid=/^\d{1,19}$/.test(account)&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&(!symbol||/^[A-Z0-9.^_-]{1,30}$/.test(symbol));
 let audit:ReturnType<typeof auditSession>|null=null,label='',error='';
 if(valid)try{
  const {entries,accountLabel}=await loadReviewLedger(account);
  audit=auditSession(symbol?entries.filter(r=>r.symbol.toUpperCase()===symbol):entries,account,date,symbol||undefined);
  label=accountLabel(account);
 }catch(e){console.error('[Review] Session audit failed:',e);error='Unable to load the session audit. Check the server log or 20,000-row history limit.';}
 return <main className="shell"><header><Link href="/" className="brand">TRADE / JOURNAL</Link><span className="muted">Read-only session audit</span></header>
  <section className="page-title"><p className="eyebrow">TRADE REVIEW / SESSION</p><h1>{valid?date+' · '+(symbol||'All symbols'):'Session details'}</h1>
   <p className="intro">Realized FIFO activity from exits occurring on this Eastern Time trading date, including partial exits of positions that remain open.</p></section>
  <nav className="pill-row"><Link href="/review?view=sessions">← Trading sessions</Link><Link href="/performance">Performance ↗</Link></nav>
  {!valid?<p className="notice">Invalid account, date or symbol.</p>:error?<p className="notice">{error}</p>:!audit?<p className="notice">No realized activity found for this session.</p>:<>
   <p className="helper">Account: {label} · Closed shares: {audit.closedShares} · FIFO matches: {audit.matches.length} · All times below are UTC. Session grouping uses America/New_York.</p>
   <ReviewTotals gross={audit.gross} fees={audit.fees} net={audit.net}/>
   <h2>Realized FIFO matches</h2><ReviewMatchTable matches={audit.matches}/>
   <h2>Participating executions</h2><ReviewExecutionTable executions={audit.executions}/>
   <p className="notice">An opening order from an earlier day can appear here because it contributed to a realized exit today. Raw order fees can differ from allocated fees when only part of an execution closes inventory.</p>
  </>}
 </main>;
}
