import Link from 'next/link';
import {reviewIsLocal,loadReviewLedger} from '@/lib/review/server';
import {activeAccountId} from '@/lib/review/account-scope';
import {screenWashSales} from '@/lib/review/wash-sales';
import {db} from '@/lib/db';
import {parseFixed,formatFixed} from '@/lib/performance/ledger';
export const dynamic='force-dynamic';
type Params={symbol?:string;year?:string};
const money=(n:string)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n));
const etToday=()=>{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const find=(name:string)=>parts.find(p=>p.type===name)?.value??'';
 return find('year')+'-'+find('month')+'-'+find('day');
};
export default async function WashSales({searchParams}:{searchParams:Promise<Params>}){
 if(!await reviewIsLocal())return <main className="shell"><p className="notice">Wash Sale Review is restricted to the local development workspace.</p></main>;
 const p=await searchParams;
 const symbol=typeof p.symbol==='string'?p.symbol.trim().toUpperCase():'';
 const year=typeof p.year==='string'?p.year:'all';
 const valid=(!symbol||/^[A-Z0-9.^_-]{1,30}$/.test(symbol))&&(year==='all'||/^20\d{2}$/.test(year));
 const active=await activeAccountId();
 let report:ReturnType<typeof screenWashSales>|null=null;
 let labels:Record<string,string>={};
 let error='';
 if(valid)try{
  // Analyze every known account, even when the sidebar scopes the *loss sales*
  // to one account. Replacement buys in other accounts can trigger wash sales.
  const source=await loadReviewLedger(null,{ignoreWorkspaceScope:true});
  const accounts=(await db().query<{id:string;account_type:string|null;user_label:string|null}>(
   'SELECT id::text,account_type,user_label FROM brokerage_accounts')).rows;
  const types=accounts.map(a=>({id:a.id,label:source.accountLabel(a.id),type:[a.account_type,a.user_label].filter(Boolean).join(' ')}));
  labels=Object.fromEntries(types.map(a=>[a.id,a.label]));
  report=screenWashSales(source.entries,types,etToday());
 }catch(e){
  console.error('[Wash Sale Review] Screening failed',e);
  error=e instanceof Error&&e.message==='LIMIT_EXCEEDED'
   ?'More than 20,000 records across accounts. Wash sale screening stopped to avoid incomplete history.'
   :'Unable to run wash sale screening. Check the database and server terminal.';
 }
 const matches=report?.candidates.filter(c=>
  (!active||c.saleAccountId===active)&&(!symbol||c.symbol===symbol)&&
  (year==='all'||c.saleDate.startsWith(year)))??[];
 const shownTotal=formatFixed(matches.reduce((s,c)=>s+parseFixed(c.estimatedDisallowed),0n));
 return <main className="shell sj-wash-page">
  <div className="sj-page-head"><div><p className="sj-kicker">TAX RECONCILIATION / SCREENING</p><h1>Wash Sale Review</h1>
   <p>Potential same-symbol replacement purchases within 30 days before or after loss sales.</p></div>
   <div className="sj-head-actions"><Link href="/wash-sales/basis">Adjusted Tax Lots ↗</Link><Link href="/performance">Realized Performance ↗</Link></div></div>
  <p className="notice"><strong>Review-only preview — not a tax ledger.</strong> Estimates are not applied to realized P&amp;L, replacement basis, holding periods, or Form 8949. Cross-account, IRA/Roth IRA, short-sale, option, substantially identical security, and incomplete-history cases need professional reconciliation.</p>
  <form className="performance-filter" action="/wash-sales" method="get">
   <span className="helper">Loss account: {active?labels[active]??'Selected account':'All Accounts'} · Replacements screened across ALL saved accounts</span>
   <label htmlFor="wash-symbol">Ticker</label><input id="wash-symbol" name="symbol" defaultValue={symbol} placeholder="NVDA" maxLength={30}/>
   <label htmlFor="wash-year">Loss year</label><select id="wash-year" name="year" defaultValue={year}><option value="all">All years</option>{[...new Set([new Date().getUTCFullYear(),...(report?.candidates??[]).map(c=>Number(c.saleDate.slice(0,4)))])].sort((a,b)=>b-a).map(y=><option value={y} key={y}>{y}</option>)}</select>
   <button type="submit">Apply</button><Link href="/wash-sales">Clear</Link>
  </form>
  {!valid?<p className="notice">Invalid ticker or loss year.</p>:error?<p role="alert" className="notice">{error}</p>:report&&<>
   <div className="sj-wash-metrics">
    <div><small>Potential matches</small><strong>{matches.length}</strong></div>
    <div><small>Estimated loss flagged</small><strong>{money(shownTotal)}</strong></div>
    <div><small>Cross-account</small><strong>{matches.filter(c=>c.crossAccount).length}</strong></div>
    <div><small>Retirement account</small><strong>{matches.filter(c=>c.retirementAccount).length}</strong></div>
    <div><small>Open 30-day loss windows</small><strong>{report.openWindowLosses}</strong></div>
   </div>
   <div className="sj-section-heading"><div><h2>Potential wash sale matches</h2>
    <p>Loss-making long FIFO matches only; results filtered to the chosen loss account, while replacement search includes all saved accounts.</p></div></div>
   {!matches.length?<p className="notice">No same-symbol replacement purchase candidates were found for the chosen filters. This does NOT prove the absence of wash sales; loss-sale windows can remain open and unobserved related securities may exist. Review limitations below.</p>:
    <div className="table-scroll"><table className="sj-wash-table"><thead><tr>
     <th>Symbol</th><th>Loss date (ET)</th><th>Loss account</th><th>Replacement date (ET)</th><th>Replacement account</th>
     <th>Days ±</th><th>Matched shares</th><th>Estimated flagged loss</th><th>Review flags</th>
    </tr></thead><tbody>{matches.map((c,i)=><tr key={c.saleId+':'+c.purchaseId+':'+i}>
     <td><strong>{c.symbol}</strong></td><td>{c.saleDate}</td><td>{labels[c.saleAccountId]??c.saleAccountId}</td>
     <td>{c.purchaseDate}</td><td>{labels[c.purchaseAccountId]??c.purchaseAccountId}</td>
     <td>{c.daysFromSale>=0?'+':''}{c.daysFromSale}</td><td>{c.matchedShares}</td>
     <td>{money(c.estimatedDisallowed)}</td>
     <td>{[c.crossAccount?'Cross-account':null,c.retirementAccount?'IRA / retirement?':null,c.pendingWindow?'30-day window open':null].filter(Boolean).join(' · ')||'Confirm basis'}</td>
    </tr>)}</tbody></table></div>}
   <div className="sj-wash-notes">
    <h2>Coverage and limitations</h2>
    <p>{report.reviewedLongLossMatches} long-loss FIFO matches examined; {report.unmatchedLongLossMatches} not fully paired with observed replacements; {report.shortLossMatches} losing short matches excluded; {report.unknownNetMatches} matches have unknown net values. Data reviewed through {report.asOf} ET.</p>
    <p>The estimated flagged amount is NOT a confirmed disallowed loss. Candidate buys are allocated in acquisition order and not reused within this screening pass. Same-symbol screening cannot detect substantially identical options, derivatives or different tickers. Prior purchases are counted only if unsold long shares remain after the loss sale, and buys used to cover shorts are excluded. Imported Webull executions are weighted-average order snapshots rather than individual tax lots.</p>
    <p>The tax rules apply across accounts and can permanently disallow losses when qualifying replacements occur in an IRA or Roth IRA. Taxable-account replacement shares can carry deferred basis and holding-period adjustments; these are not yet modeled. Year-end matches may extend into the following January. Broker 1099-B wash-sale information and the full trade history across all accounts must be reconciled before filing.</p>
    <p className="helper">Authoritative references: <a href="https://www.irs.gov/publications/p550" target="_blank" rel="noreferrer">IRS Publication 550 ↗</a> · <a href="https://www.irs.gov/instructions/i8949" target="_blank" rel="noreferrer">IRS Form 8949 instructions ↗</a></p>
   </div>
  </>}
 </main>;
}
