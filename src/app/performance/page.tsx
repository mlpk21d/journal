import Link from 'next/link';
import {headers} from 'next/headers';
import {activeAccountId} from '@/lib/review/account-scope';
import {db} from '@/lib/db';
import {buildLedger,parseFixed,formatFixed,type LedgerInput} from '@/lib/performance/ledger';
import {displayAccount} from '@/lib/review/account-label';
import {normalizeWebullOrderFee} from '@/lib/performance/fee-policy';
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
 await searchParams;
 const selected=(await activeAccountId())??'all';
 let accounts:{id:string;external_account_id:string;account_type:string|null;broker:string;user_label:string|null}[]=[];
 let data:LedgerInput[]=[];
 let error='';
 let truncated=false;
 try{
  const pool=db();
  const a=await pool.query<{id:string;external_account_id:string;account_type:string|null;broker:string;user_label:string|null}>(
   'SELECT id::text,external_account_id,account_type,broker,user_label FROM brokerage_accounts ORDER BY id');
  accounts=a.rows;
  const valid=selected==='all'||accounts.some(a=>a.id===selected);
  if(!valid)throw new Error('Unknown account selection');
  // Matching starts with earliest available history; never filter to a recent
  // date before computing FIFO, because doing so discards opening share lots.
  const r=await pool.query<{
   id:string;account_id:string;symbol:string;side:'BUY'|'SELL';quantity:string;
   price:string;executed_at:Date;fees:string|null;fee_count:string
  }>(`WITH ledger_rows AS (
    SELECT e.id::text AS id,e.brokerage_account_id::text AS account_id,
     e.symbol,e.side,e.quantity::text,e.price::text,e.executed_at,
     COALESCE(f.total_fees,0)::text AS fees,COALESCE(f.fee_count,0)::text AS fee_count
    FROM executions e
    LEFT JOIN LATERAL (
      SELECT SUM(amount) AS total_fees,COUNT(*) AS fee_count
      FROM brokerage_order_fees WHERE brokerage_order_id=e.brokerage_order_id
    ) f ON TRUE
    WHERE e.source='webull_order_snapshot' AND e.instrument_type='EQUITY'
      AND ($1::bigint IS NULL OR e.brokerage_account_id=$1::bigint)
    UNION ALL
    SELECT 'manual:'||m.id::text AS id,m.brokerage_account_id::text AS account_id,
     m.symbol,m.side,m.quantity::text,m.price::text,
     m.executed_at,m.fees::text AS fees,'1'::text AS fee_count
    FROM manual_trades m
    WHERE ($1::bigint IS NULL OR m.brokerage_account_id=$1::bigint)
   )
   SELECT * FROM ledger_rows ORDER BY executed_at ASC,id ASC LIMIT 20001`,
   [selected==='all'?null:selected]);
  truncated=r.rows.length>20000;
  if(!truncated)data=r.rows.map(x=>({id:x.id,accountId:x.account_id,symbol:x.symbol,
   side:x.side,quantity:x.quantity,price:x.price,executedAt:x.executed_at.toISOString(),
   ...(x.id.startsWith('manual:')?{fees:x.fees??'0',feeKnown:true}:normalizeWebullOrderFee(x.fees))}));
 }catch(e){console.error('[Performance] ledger loading failed:',e);error='Unable to calculate performance. Check the Next.js terminal.';}
 let report:ReturnType<typeof buildLedger>|null=null;
 if(!error&&!truncated){try{report=buildLedger(data);}catch(e){console.error('[Performance] matching failed:',e);error='Unable to match imported orders. Check server terminal.';}}
 const totalClosed=report?.matches.length??0;
 const gross=report?.gross??'0';
 const accountName=(id:string)=>{const a=accounts.find(a=>a.id===id);return a?displayAccount(a):'Unknown account';};
 const summaries=accounts.filter(a=>selected==='all'||a.id===selected).map(a=>{
  const matched=report?.matches.filter(m=>m.accountId===a.id)??[];
  const gross=matched.reduce((n,m)=>n+parseFixed(m.gross),0n);
  const netComplete=matched.every(m=>m.net!==null);
  const net=matched.reduce((n,m)=>n+(m.net===null?0n:parseFixed(m.net)),0n);
  const shares=matched.reduce((n,m)=>n+parseFixed(m.quantity),0n);
  const positionCount=report?.openPositions.filter(p=>p.accountId===a.id).length??0;
  const sourceCount=data.filter(d=>d.accountId===a.id).length;
  return {id:a.id,label:accountName(a.id),gross:formatFixed(gross),
   net:netComplete?formatFixed(net):null,matched:matched.length,
   shares:formatFixed(shares),positionCount,sourceCount};
 });
 const recent=[...(report?.matches??[])].reverse().slice(0,80);
 return <main className="shell"><header><Link href="/" className="brand">TRADE / JOURNAL</Link><span className="muted">Provisional performance · Local only</span></header>
  <section className="page-title"><p className="eyebrow">TRADE ACCOUNTING</p><h1>Realized performance</h1>
   <p className="intro">Signed FIFO matching of Webull completed-order snapshots and manually entered stock trades or historical opening shares. Sales can open short positions; subsequent buys first cover those shorts. Results remain provisional until verified against brokerage records.</p></section>
  <nav className="pill-row"><Link href="/import">Import trades ↗</Link><Link href="/manual">Manual trades ↗</Link><Link href="/trades">Trade history ↗</Link><Link href="/wash-sales">Wash Sale Review ↗</Link></nav>
  <p className="helper">Account scope: {selected==='all'?'All Accounts':accountName(selected)} · Change the selected account from the sidebar.</p>
  {error||truncated?<p className="notice">{error||'Over 20,000 imported records. The report stopped rather than silently dropping older cost basis. Contact developer to implement paged ledger processing.'}</p>:report&&<>
   <div className="performance-metrics">
    <div><small>Matched shares</small><strong>{report.closedShares}</strong></div>
    <div><small>Matched gross P&amp;L (partial)</small><strong>{usd(gross)}</strong></div>
    <div><small>Complete net P&amp;L</small><strong>{report.netKnown?usd(report.net):'Unverified'}</strong></div>
    <div><small>FIFO lot matches</small><strong>{totalClosed}</strong></div>
   </div>
   <p className="notice">The gross figure is a <strong>partial subtotal for matched shares only</strong>, not your complete account profit or loss. It excludes fees and assumes an initial SELL opens a short when no earlier long shares exist in the journal. You confirmed no older holdings exist; short trades can therefore close through a later BUY. Manually entered costs, including $0, are unverified inputs. These provisional FIFO results are not tax-adjusted and do not account for wash sales, splits, transfers, or specific-lot identification.</p>
   <h2>Realized P&amp;L by brokerage account</h2>
   <p className="helper">Each row is calculated strictly from transactions assigned to that internal brokerage account ID. The journal's figures are provisional trade-based totals, not Webull's account equity, deposits, or unrealized P&amp;L. Use the account filter to inspect one account.</p>
   <div className="table-scroll"><table><thead><tr><th>Account</th><th>Records</th><th>FIFO matches</th><th>Closed shares</th><th>Gross realized P&amp;L</th><th>Net realized P&amp;L</th><th>Open symbols</th></tr></thead><tbody>
    {summaries.map(a=><tr key={a.id}><td>{a.label}</td><td>{a.sourceCount}</td><td>{a.matched}</td><td>{a.shares}</td><td>{usd(a.gross)}</td><td>{usd(a.net)}</td><td>{a.positionCount}</td></tr>)}
   </tbody></table></div>
   <p className="helper">If an account total differs from Webull, compare the transactions imported for that specific account, recorded order fees, short covers and any manual entries. Manual records are included in the record count. Opening short sales do not create realized P&amp;L until covered.</p>
   <p className="helper">Fee policy: an imported Webull order without a fee record is treated as $0 for this journal report. Reported nonzero Webull fees and fees entered on manual trades are deducted from realized net P&amp;L. This assumption does not verify the broker's actual fee total.</p>
   <h2>Recent FIFO closures</h2>
   {!recent.length?<p className="notice">No matched stock sales yet. Import older buy and sell orders to calculate realized performance.</p>:<div className="table-scroll"><table><thead><tr><th>Closed (UTC)</th><th>Account</th><th>Symbol</th><th>Direction</th><th>Shares</th><th>Gross P&amp;L</th><th>Net P&amp;L</th></tr></thead><tbody>
    {recent.map((m,i)=><tr key={m.sellId+'-'+m.buyId+'-'+i}><td>{m.closedAt.replace('T',' ').slice(0,19)}</td><td>{accountName(m.accountId)}</td><td>{m.symbol}</td><td>{m.direction}</td><td>{m.quantity}</td><td>{usd(m.gross)}</td><td>{usd(m.net)}</td></tr>)}
   </tbody></table></div>}
   <h2>Unreconciled journal positions</h2>
   {report.openPositions.length===0?<p className="muted">No remaining journal long or short lots.</p>:<div className="table-scroll"><table><thead><tr><th>Account</th><th>Symbol</th><th>Direction</th><th>Signed shares</th><th>Opening value (before fees)</th></tr></thead><tbody>
    {report.openPositions.map((p,i)=><tr key={i}><td>{accountName(p.accountId)}</td><td>{p.symbol}</td><td>{p.side}</td><td>{p.quantity}</td><td>{usd(p.basis)}</td></tr>)}
   </tbody></table></div>}
  </>}
 </main>;
}
