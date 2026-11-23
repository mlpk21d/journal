import {db} from '@/lib/db';
import {formatBrokerageAccount} from '@/lib/webull/account-format';
export const dynamic='force-dynamic';
export default async function Trades(){
 let rows:Record<string,unknown>[]=[];let error=false;
 try {const r=await db().query(`SELECT history.*, a.account_type, a.external_account_id FROM (
  SELECT e.id::text AS row_id,e.symbol,e.side,e.quantity::text,e.price::text,e.executed_at,e.source,e.brokerage_account_id::text AS account_id,
    COALESCE((SELECT SUM(f.amount) FROM brokerage_order_fees f WHERE f.brokerage_order_id=e.brokerage_order_id),0)::text AS order_fees
  FROM executions e
  UNION ALL
  SELECT 'manual:'||m.id::text AS row_id,m.symbol,m.side,m.quantity::text,m.price::text,
    m.executed_at,'manual_trade'::text AS source,m.brokerage_account_id::text AS account_id,m.fees::text AS order_fees
  FROM manual_trades m
 ) history JOIN brokerage_accounts a ON a.id::text=history.account_id ORDER BY executed_at DESC,row_id DESC LIMIT 100`);rows=r.rows;}catch{error=true;}
 return <main className="shell"><header><a className="brand" href="/">TRADE / JOURNAL</a><span className="muted">Trade history</span></header>
 <section className="page-title"><p className="eyebrow">TRANSACTION HISTORY</p><h1>Trade history</h1>
 <p className="intro">Webull rows are completed-order weighted-average snapshots, not individual exchange fills. Manual entries and Webull trades are identified separately and grouped by the same stored brokerage-account IDs used in realized P&amp;L. Compare their account labels and symbols here when checking differences.</p></section>
 {error?<p className="notice">Database unavailable or migrations pending.</p>:rows.length===0?<p className="notice">No transactions yet. Import Webull orders or enter a manual trade.</p>:
 <div className="table-scroll"><table><thead><tr><th>Time (UTC)</th><th>Account</th><th>Symbol</th><th>Source</th><th>Side</th><th>Shares</th><th>Avg price</th><th>Order fees</th></tr></thead><tbody>
 {rows.map((r,i)=><tr key={i}><td>{new Date(String(r.executed_at)).toISOString().replace('T',' ').slice(0,19)}</td><td>{formatBrokerageAccount(r.account_type as string|null,String(r.external_account_id))}</td><td>{String(r.symbol)}</td><td>{r.source==='manual_trade'?'Manual':'Webull'}</td><td>{String(r.side)}</td><td>{String(r.quantity)}</td><td>{String(r.price)}</td><td>{String(r.order_fees)}</td></tr>)}
 </tbody></table></div>}</main>;
}
