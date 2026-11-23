import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export default async function Trades(){
 let rows:Record<string,unknown>[]=[];let error=false;
 try {const r=await db().query(`SELECT * FROM (
  SELECT e.id::text AS row_id,e.symbol,e.side,e.quantity::text,e.price::text,e.executed_at,e.source,
    COALESCE((SELECT SUM(f.amount) FROM brokerage_order_fees f WHERE f.brokerage_order_id=e.brokerage_order_id),0)::text AS order_fees
  FROM executions e
  UNION ALL
  SELECT 'manual:'||m.id::text AS row_id,m.symbol,'BUY'::text AS side,m.quantity::text,m.unit_basis::text AS price,
    m.acquired_at AS executed_at,'manual_opening_lot'::text AS source,'0'::text AS order_fees
  FROM manual_opening_lots m
 ) history ORDER BY executed_at DESC,row_id DESC LIMIT 100`);rows=r.rows;}catch{error=true;}
 return <main className="shell"><header><a className="brand" href="/">TRADE / JOURNAL</a><span className="muted">Trade history</span></header>
 <section className="page-title"><p className="eyebrow">WEBULL IMPORTS</p><h1>Trade history</h1>
 <p className="intro">Webull rows are completed-order weighted-average snapshots, not individual exchange fills. Manual opening lots are identified separately and are not broker-confirmed executions.</p></section>
 {error?<p className="notice">Database unavailable or migrations pending.</p>:rows.length===0?<p className="notice">No transactions yet. Import Webull orders or add a historical opening lot.</p>:
 <div className="table-scroll"><table><thead><tr><th>Time (UTC)</th><th>Symbol</th><th>Source</th><th>Side</th><th>Shares</th><th>Avg price</th><th>Order fees</th></tr></thead><tbody>
 {rows.map((r,i)=><tr key={i}><td>{new Date(String(r.executed_at)).toISOString().replace('T',' ').slice(0,19)}</td><td>{String(r.symbol)}</td><td>{r.source==='manual_opening_lot'?'Manual opening lot':'Webull'}</td><td>{String(r.side)}</td><td>{String(r.quantity)}</td><td>{String(r.price)}</td><td>{String(r.order_fees)}</td></tr>)}
 </tbody></table></div>}</main>;
}
