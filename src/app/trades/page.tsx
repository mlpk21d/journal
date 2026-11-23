import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export default async function Trades(){
 let rows:Record<string,unknown>[]=[];let error=false;
 try {const r=await db().query(`SELECT e.symbol,e.side,e.quantity::text,e.price::text,e.executed_at,e.source,
 COALESCE((SELECT SUM(f.amount) FROM brokerage_order_fees f WHERE f.brokerage_order_id=e.brokerage_order_id),0)::text AS order_fees
 FROM executions e ORDER BY e.executed_at DESC,e.id DESC LIMIT 100`);rows=r.rows;}catch{error=true;}
 return <main className="shell"><header><a className="brand" href="/">TRADE / JOURNAL</a><span className="muted">Trade history</span></header>
 <section className="page-title"><p className="eyebrow">WEBULL IMPORTS</p><h1>Trade history</h1>
 <p className="intro">Completed-order snapshots are weighted-average executions. They are not individual exchange fills. Fees shown belong to the order.</p></section>
 {error?<p className="notice">Database unavailable or migrations pending.</p>:rows.length===0?<p className="notice">No imported transactions yet. Run a read-only sync using the API.</p>:
 <div className="table-scroll"><table><thead><tr><th>Time (UTC)</th><th>Symbol</th><th>Side</th><th>Shares</th><th>Avg price</th><th>Order fees</th></tr></thead><tbody>
 {rows.map((r,i)=><tr key={i}><td>{new Date(String(r.executed_at)).toISOString().replace('T',' ').slice(0,19)}</td><td>{String(r.symbol)}</td><td>{String(r.side)}</td><td>{String(r.quantity)}</td><td>{String(r.price)}</td><td>{String(r.order_fees)}</td></tr>)}
 </tbody></table></div>}</main>;
}
