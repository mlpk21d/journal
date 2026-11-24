import Link from 'next/link';
import {reviewIsLocal,loadReviewLedger} from '@/lib/review/server';
import {activeAccountId} from '@/lib/review/account-scope';
import {db} from '@/lib/db';
import {parseFixed,formatFixed} from '@/lib/performance/ledger';
import {buildTaxLotPreview} from '@/lib/review/wash-tax-lots';
export const dynamic='force-dynamic';
type Params={symbol?:string;year?:string};
const easternDate=(iso:string)=>{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(iso));
 const f=(k:string)=>parts.find(p=>p.type===k)?.value??'';
 return f('year')+'-'+f('month')+'-'+f('day');
};
const money=(n:string|null)=>n===null?'Unknown':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n));
const total=(items:string[])=>formatFixed(items.reduce((sum,n)=>sum+parseFixed(n),0n));
const etToday=()=>{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const f=(t:string)=>parts.find(p=>p.type===t)?.value??'';
 return f('year')+'-'+f('month')+'-'+f('day');
};
export default async function WashTaxLots({searchParams}:{searchParams:Promise<Params>}){
 if(!await reviewIsLocal())return <main className="shell"><p className="notice">Tax-lot analysis is available only in the local development workspace.</p></main>;
 const params=await searchParams;
 const symbol=typeof params.symbol==='string'?params.symbol.trim().toUpperCase():'';
 const year=typeof params.year==='string'?params.year:'all';
 const valid=(!symbol||/^[A-Z0-9.^_-]{1,30}$/.test(symbol))&&(year==='all'||/^(19|20)\d{2}$/.test(year));
 const selected=await activeAccountId();
 let preview:ReturnType<typeof buildTaxLotPreview>|null=null;
 let labels:Record<string,string>={};let error='';
 if(valid)try{
  // Tax replacement shares must be searched across every recorded account,
  // even when the sidebar selects which loss dispositions are displayed.
  const source=await loadReviewLedger(null,{ignoreWorkspaceScope:true});
  const accounts=(await db().query<{id:string;account_type:string|null;user_label:string|null}>(
   'SELECT id::text,account_type,user_label FROM brokerage_accounts')).rows;
  const taxAccounts=accounts.map(a=>({id:a.id,label:source.accountLabel(a.id),
   type:[a.account_type,a.user_label].filter(Boolean).join(' ')}));
  labels=Object.fromEntries(taxAccounts.map(a=>[a.id,a.label]));
  preview=buildTaxLotPreview(source.entries,taxAccounts,etToday());
 }catch(e){
  console.error('[Tax lot preview] Calculation failed',e);
  error=e instanceof Error&&e.message==='LIMIT_EXCEEDED'
   ?'Over 20,000 executions across brokerage accounts. No partial tax-lot results were calculated.'
   :'Unable to build tax-lot preview. Check the server and database logs.';
 }
 const trades=preview?.dispositions.filter(x=>(!selected||x.accountId===selected)&&(!symbol||x.symbol===symbol)&&
  (year==='all'||easternDate(x.closedAt).startsWith(year)))??[];
 const allocations=preview?.adjustments.filter(x=>(!selected||x.saleAccountId===selected)&&(!symbol||x.symbol===symbol)&&
  (year==='all'||x.saleDate.startsWith(year)))??[];
 const open=preview?.openLots.filter(x=>(!selected||x.accountId===selected)&&(!symbol||x.symbol===symbol))??[];
 const known=trades.filter(x=>x.estimatedTaxNet!==null);
 const raw=total(known.map(x=>x.originalNet!));
 const adjusted=total(known.map(x=>x.estimatedTaxNet!));
 const carry=total(open.map(x=>x.basisIncrease));
 const ira=total(allocations.filter(x=>x.treatment==='ira-permanent').map(x=>x.disallowed));
 return <main className="shell sj-wash-page">
  <div className="sj-page-head"><div><p className="sj-kicker">TAX RECONCILIATION / PHASE 2</p><h1>Adjusted Tax Lots — Preview</h1>
   <p>Provisional FIFO tax adjustments, deferred losses and open replacement basis by brokerage account.</p></div>
   <Link href="/wash-sales">Wash Sale Review ↗</Link></div>
  <p className="notice"><strong>Tax-research preview only.</strong> These estimates are NOT saved to tax_lots, wash_sale_adjustments, or realized trading P&amp;L. This view is not reconciled to brokerage 1099-B, and must not be used to file Form 8949. Missing trades, transfers, options, short-sale rules and corporate actions can materially change results.</p>
  <form className="performance-filter" action="/wash-sales/basis" method="get">
   <span className="helper">Disposition account: {selected?labels[selected]??'Selected':'All Accounts'} · Replacement search: ALL saved accounts</span>
   <label htmlFor="tax-symbol">Ticker</label><input id="tax-symbol" name="symbol" defaultValue={symbol} placeholder="NVDA" maxLength={30}/>
   <label htmlFor="tax-year">Sale year</label><select id="tax-year" name="year" defaultValue={year}>
    <option value="all">All years</option>{[...new Set((preview?.dispositions??[]).map(t=>easternDate(t.closedAt).slice(0,4)))].sort().reverse().map(y=><option key={y} value={y}>{y}</option>)}
   </select><button type="submit">Apply</button><Link href="/wash-sales/basis">Clear</Link>
  </form>
  {!valid?<p role="alert" className="notice">Invalid ticker or year.</p>:error?<p role="alert" className="notice">{error}</p>:preview&&<>
   <div className="sj-wash-metrics">
    <div><small>Known original net (long FIFO)</small><strong>{known.length?money(raw):'—'}</strong></div>
    <div><small>Estimated adjusted net (long FIFO)</small><strong>{known.length?money(adjusted):'—'}</strong></div>
    <div><small>Basis carried on open shares</small><strong>{money(carry)}</strong></div>
    <div><small>IRA disallowance flags</small><strong>{money(ira)}</strong></div>
    <div><small>Wash allocations</small><strong>{allocations.length}</strong></div>
   </div>
   <div className="sj-section-heading"><div><h2>Disposition tax adjustments</h2>
    <p>Each completed LONG FIFO match is shown separately; open trades and short-sale matches need additional tax rules.</p></div></div>
   {!trades.length?<p className="notice">No completed long FIFO matches for these filters.</p>:
    <div className="table-scroll"><table className="sj-wash-table"><thead><tr>
     <th>Date (ET)</th><th>Symbol</th><th>Account</th><th>Shares</th><th>Original net</th>
     <th>Carried basis used</th><th>Loss disallowed</th><th>Estimated adjusted net</th><th>Review flags</th>
    </tr></thead><tbody>{[...trades].reverse().slice(0,500).map(t=><tr key={t.id}>
     <td>{easternDate(t.closedAt)}</td><td><strong>{t.symbol}</strong></td>
     <td>{labels[t.accountId]??t.accountId}</td><td>{t.quantity}</td><td>{money(t.originalNet)}</td>
     <td>{money(t.basisIncrease)}</td><td>{money(t.disallowed)}</td><td>{money(t.estimatedTaxNet)}</td>
     <td>{t.flags.join(' · ')||'—'}</td>
    </tr>)}</tbody></table></div>}
   <div className="sj-section-heading" style={{marginTop:28}}><div><h2>Replacement share allocations</h2>
    <p>Deferred loss is added to taxable replacement lots; IRA/Roth IRA matches are flagged as non-carrying disallowances.</p></div></div>
   {!allocations.length?<p className="notice">No matched same-symbol replacement purchases.</p>:
    <div className="table-scroll"><table className="sj-wash-table"><thead><tr>
     <th>Symbol</th><th>Loss sale</th><th>Loss account</th><th>Replacement buy</th><th>Replacement account</th>
     <th>Shares</th><th>Disallowed loss</th><th>Treatment</th><th>Inherited holding start</th>
    </tr></thead><tbody>{allocations.slice(0,500).map((a,i)=><tr key={a.saleId+':'+a.purchaseId+':'+i}>
     <td>{a.symbol}</td><td>{a.saleDate}</td><td>{labels[a.saleAccountId]??a.saleAccountId}</td>
     <td>{a.purchaseDate}</td><td>{labels[a.purchaseAccountId]??a.purchaseAccountId}</td>
     <td>{a.quantity}</td><td>{money(a.disallowed)}</td>
     <td>{a.treatment==='ira-permanent'?'IRA — no basis increase':'Taxable basis carry'}</td>
     <td>{a.inheritedHoldingStart.slice(0,10)}</td>
    </tr>)}</tbody></table></div>}
   <div className="sj-section-heading" style={{marginTop:28}}><div><h2>Open adjusted purchase lots</h2>
    <p>Original purchase cost before buy fees + current wash-loss carry, for shares remaining open in the FIFO ledger.</p></div></div>
   {!open.length?<p className="notice">No open long purchase lots in this view.</p>:
    <div className="table-scroll"><table className="sj-wash-table"><thead><tr>
     <th>Symbol</th><th>Account</th><th>Acquired</th><th>Shares</th><th>Purchase cost*</th>
     <th>Wash carry</th><th>Indicative adjusted cost*</th><th>Inherited holding start</th>
    </tr></thead><tbody>{open.slice(0,500).map((lot,i)=><tr key={lot.buyId+':'+i}>
     <td>{lot.symbol}</td><td>{labels[lot.accountId]??lot.accountId}</td><td>{lot.acquiredAt.slice(0,10)}</td>
     <td>{lot.quantity}</td><td>{money(lot.originalBasis)}</td><td>{money(lot.basisIncrease)}</td>
     <td>{money(lot.estimatedBasis)}</td><td>{lot.holdingStart?.slice(0,10)??'—'}</td>
    </tr>)}</tbody></table></div>}
   <div className="sj-wash-notes">
    <h2>Reconciliation requirements</h2>
    <p>Across all saved accounts: {preview.pendingWindows} loss matches still have an open 30-day replacement window; {preview.unmatchedLosses} loss portions have no fully observed replacement; {preview.shortMatches} short-sale matches and {preview.retirementSourceMatches} IRA-origin dispositions are excluded from taxable net; {preview.unknownNetMatches} long matches have unknown net P&amp;L. The sidebar controls the displayed account, but the underlying wash calculation always checks all saved accounts. Verify that each account belongs to the same taxpayer or otherwise falls under the applicable related-account rules.</p>
    <p>*Indicative purchase cost excludes opening buy commissions and other broker tax-basis adjustments. Adjusted realized net figures begin from the journal's fee-aware FIFO result and apply wash carry/disallowance estimates. This is not a book-versus-tax balance reconciliation, and open-lot cost estimates are not certified tax basis.</p>
    <p>Replacement purchases are attributed by acquisition chronology within a 61-day same-symbol window. Prior purchases must be held after the loss sale. A later loss on adjusted replacement shares can be carried into a new purchase. IRA/Roth IRA replacements are separately flagged without adding basis; this needs reliable account type verification. Holding-start information is tracked provisionally, but tax holding-period classifications are not yet produced.</p>
    <p>No options or substantially identical cross-symbol instruments, short-sale wash-sale rules, corporate actions, elections, imported transfers, spouse accounts, or IRS filing adjustments are modeled. Please reconcile against the full broker transaction history and Forms 1099-B before using any estimate for tax decisions.</p>
    <p className="helper"><a target="_blank" rel="noreferrer" href="https://www.irs.gov/publications/p550">IRS Publication 550 ↗</a> · <a target="_blank" rel="noreferrer" href="https://www.irs.gov/instructions/i8949">Form 8949 instructions ↗</a> · <a target="_blank" rel="noreferrer" href="https://www.irs.gov/irb/2008-03_IRB">IRS Revenue Ruling 2008-5 (IRA wash sales) ↗</a></p>
   </div>
  </>}
 </main>;
}
