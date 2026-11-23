import Link from 'next/link';
import {headers} from 'next/headers';
import {db} from '@/lib/db';
import {buildLedger,parseFixed,formatFixed,type LedgerInput} from '@/lib/performance/ledger';
export const dynamic='force-dynamic';
type Params={account?:string};
function usd(s:string|null):string{
 if(s===null)return 'Unverified';
 const n=Number(s);return Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n):s;
}
export default async function Performance({searchParams}:{searchParams:Promise<Params>}){
 const h=await headers(),host=h.get('host')??'';
 const local=/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
 if(!local||process.env.NODE_ENV!=='development'){
  return <main className="shell"><header><Link href="/" className="brand">TRADE / JOURNAL</Link></header><p className="notice">Performance dashboard is restricted to the local development application until login protection is implemented.</p></main>;
 }
 const query=await searchParams;
 const selected=typeof query.account==='string'&&/^\d{1,19}$/.test(query.account)?query.account:'all';
 let accounts:{id:string;external_account_id:string;account_type:string|null}[]=[];
 let data:LedgerInput[]=[];
 let error='';
 let truncated=false;
 try{
  const pool=db();
  const a=await pool.query<{id:string;external_account_id:string;account_type:string|null}>(
   'SELECT id::text,external_account_id,account_type FROM brokerage_accounts ORDER BY id');
  accounts=a.rows;
  const valid=selected==='all'||accounts.some(a=>a.id===selected);
  if(!valid)throw new Error('Unknown account selection');
  // Matching starts with earliest available history; never filter to a recent
  // date before computing FIFO, because doing so discards opening share lots.
  const r=await pool.query<{
   id:string;account_id:string;symbol:string;side:'BUY'|'SELL';quantity:string;
   price:string;executed_at:Date;fees:string|null;fee_count:string
  }>(`SELECT e.id::text,e.brokerage_account_id::text AS account_id,e.symbol,e.side,
   e.quantity::text,e.price::text,e.executed_at,
   f.total_fees::text AS fees,COALESCE(f.fee_count,0)::text AS fee_count
   FROM executions e
   LEFT JOIN LATERAL (
      SELECT SUM(amount) AS total_fees,COUNT(*) AS fee_count
      FROM brokerage_order_fees WHERE brokerage_order_id=e.brokerage_order_id
   ) f ON TRUE
   WHERE e.source='webull_order_snapshot' AND e.instrument_type='EQUITY'
   AND ($1::bigint IS NULL OR e.brokerage_account_id=$1::bigint)
   ORDER BY e.executed_at ASC,e.id ASC LIMIT 20001`,
   [selected==='all'?null:selected]);
  truncated=r.rows.length>20000;
  if(!truncated)data=r.rows.map(x=>({id:x.id,accountId:x.account_id,symbol:x.symbol,
   side:x.side,quantity:x.quantity,price:x.price,executedAt:x.executed_at.toISOString(),
   fees:x.fees,feeKnown:Number(x.fee_count)>0}));
 }catch(e){console.error('[Performance] ledger loading failed:',e);error='Unable to calculate performance. Check the Next.js terminal.';}
 const report=!error&&!truncated?buildLedger(data):null;
 const totalClosed=report?.matches.length??0;
 const gross=report?.gross??'0';
 const incomplete=!!report?.unmatchedSales.length;
 const accountName=(id:string)=>'•••• '+(accounts.find(a=>a.id===id)?.external_account_id.slice(-4)??id.slice(-4));
 const recent=[...(report?.matches??[])].reverse().slice(0,80);
 return <main className="shell"><header><Link href="/" className="brand">TRADE / JOURNAL</Link><span className="muted">Provisional performance · Local only</span></header>
  <section className="page-title"><p className="eyebrow">TRADE ACCOUNTING</p><h1>Realized performance</h1>
   <p className="intro">FIFO matching of imported completed-order snapshots. Gross P&amp;L excludes fees; net P&amp;L is shown only when the matched orders include verified fee records.</p></section>
  <nav className="pill-row"><Link href="/import">Import trades ↗</Link><Link href="/trades">Trade history ↗</Link></nav>
  <form action="/performance" method="get" className="performance-filter">
   <label htmlFor="performance-account">Account</label>
   <select id="performance-account" name="account" defaultValue={selected}>
    <option value="all">All accounts (separate matching)</option>
    {accounts.map(a=><option value={a.id} key={a.id}>{a.account_type??'Brokerage'} · {accountName(a.id)}</option>)}
   </select>
   <button type="submit">Apply</button>
  </form>
  {error||truncated?<p className="notice">{error||'Over 20,000 imported records. The report stopped rather than silently dropping older cost basis. Contact developer to implement paged ledger processing.'}</p>:report&&<>
   <div className="performance-metrics">
    <div><small>Matched shares</small><strong>{report.closedShares}</strong></div>
    <div><small>Matched gross P&amp;L</small><strong>{incomplete?'Incomplete':usd(gross)}</strong></div>
    <div><small>Matched net P&amp;L</small><strong>{!incomplete&&report.netKnown?usd(report.net):'Unverified'}</strong></div>
    <div><small>FIFO lot matches</small><strong>{totalClosed}</strong></div>
   </div>
   <p className="notice">Provisional performance only. This is not tax-adjusted P&amp;L or a wash-sale calculation. Complete historical cost basis, stock splits, transfers, and fee details must be reconciled before relying on totals. Buy and sell sides are matched separately for each account and ticker.</p>
   {report.unmatchedSales.length>0&&<div className="notice"><strong>Missing opening history:</strong> {report.unmatchedSales.length} sale(s) exceed available purchased shares. Their profit or loss cannot be calculated reliably. Import earlier trades or opening holdings.</div>}
   {report.matches.some(x=>x.net===null)&&<p className="notice">Some matching orders did not report fees. Net P&amp;L is withheld rather than treating missing fees as $0.</p>}
   <h2>Recent FIFO closures</h2>
   {!recent.length?<p className="notice">No matched stock sales yet. Import older buy and sell orders to calculate realized performance.</p>:<div className="table-scroll"><table><thead><tr><th>Closed (UTC)</th><th>Account</th><th>Symbol</th><th>Shares</th><th>Gross P&amp;L</th><th>Net P&amp;L</th></tr></thead><tbody>
    {recent.map((m,i)=><tr key={m.sellId+'-'+m.buyId+'-'+i}><td>{m.closedAt.replace('T',' ').slice(0,19)}</td><td>{accountName(m.accountId)}</td><td>{m.symbol}</td><td>{m.quantity}</td><td>{usd(m.gross)}</td><td>{usd(m.net)}</td></tr>)}
   </tbody></table></div>}
   <h2>Open imported positions</h2>
   {report.openPositions.length===0?<p className="muted">No remaining imported buy lots.</p>:<div className="table-scroll"><table><thead><tr><th>Account</th><th>Symbol</th><th>Remaining shares</th><th>Original basis (before fees)</th></tr></thead><tbody>
    {report.openPositions.map((p,i)=><tr key={i}><td>{accountName(p.accountId)}</td><td>{p.symbol}</td><td>{p.quantity}</td><td>{usd(p.basis)}</td></tr>)}
   </tbody></table></div>}
  </>}
 </main>;
}
