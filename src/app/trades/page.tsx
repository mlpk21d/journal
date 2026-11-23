import Link from 'next/link';
import {db} from '@/lib/db';
import {formatBrokerageAccount} from '@/lib/webull/account-format';
export const dynamic='force-dynamic';

type Params={symbol?:string};
export default async function Trades({searchParams}:{searchParams:Promise<Params>}){
 const params=await searchParams;
 const rawSymbol=typeof params.symbol==='string'?params.symbol.trim().toUpperCase():'';
 const symbol=rawSymbol.replace(/^\$/,'');
 const invalid=!!symbol&&!/^[A-Z0-9.^_-]{1,30}$/.test(symbol);
 let rows:Record<string,unknown>[]=[];let error=false;
 if(!invalid){
  try {
   // Apply the filter to BOTH sources before the newest-100 limit; otherwise
   // older matching transactions disappear when unrelated trades fill the page.
   const r=await db().query(`SELECT history.*, a.account_type, a.external_account_id FROM (
    SELECT e.id::text AS row_id,e.symbol,e.side,e.quantity::text,e.price::text,e.executed_at,e.source,e.brokerage_account_id::text AS account_id,
      COALESCE((SELECT SUM(f.amount) FROM brokerage_order_fees f WHERE f.brokerage_order_id=e.brokerage_order_id),0)::text AS order_fees
    FROM executions e
    WHERE ($1::text IS NULL OR UPPER(e.symbol)=$1)
    UNION ALL
    SELECT 'manual:'||m.id::text AS row_id,m.symbol,m.side,m.quantity::text,m.price::text,
      m.executed_at,'manual_trade'::text AS source,m.brokerage_account_id::text AS account_id,m.fees::text AS order_fees
    FROM manual_trades m
    WHERE ($1::text IS NULL OR UPPER(m.symbol)=$1)
   ) history JOIN brokerage_accounts a ON a.id::text=history.account_id
   ORDER BY executed_at DESC,row_id DESC LIMIT 100`,[symbol||null]);
   rows=r.rows;
  }catch(e){console.error('[Trades] History query failed:',e);error=true;}
 }
 return <main className="shell"><header><Link className="brand" href="/">TRADE / JOURNAL</Link><span className="muted">Trade history</span></header>
 <section className="page-title"><p className="eyebrow">TRANSACTION HISTORY</p><h1>Trade history</h1>
 <p className="intro">Webull rows are completed-order weighted-average snapshots, not individual exchange fills. Manual entries and Webull trades are identified separately and grouped by the same stored brokerage-account IDs used in realized P&amp;L. Compare their account labels and symbols here when checking differences.</p></section>
 <form action="/trades" method="get" className="performance-filter">
  <label htmlFor="trade-symbol">Ticker symbol</label>
  <input id="trade-symbol" name="symbol" type="search" placeholder="e.g. NVDA" defaultValue={rawSymbol} maxLength={31} autoCapitalize="characters" />
  <button type="submit">Filter</button>
  {symbol&&<Link href="/trades">Clear filter</Link>}
 </form>
 {invalid?<p className="notice" role="alert">Enter a valid ticker symbol, such as NVDA, MU, or BRK.B.</p>:
 error?<p className="notice">Database unavailable or migrations pending.</p>:
 rows.length===0?<p className="notice">{symbol?'No transactions found for '+symbol+'.':'No transactions yet. Import Webull orders or enter a manual trade.'}</p>:<>
 <p className="helper">{symbol?'Showing '+rows.length+' most recent '+symbol+' transaction(s) across all accounts.':'Showing the 100 most recent transactions across all symbols.'}{rows.length===100?' Results are limited to the most recent 100 matching records.':''}</p>
 <div className="table-scroll"><table><thead><tr><th>Time (UTC)</th><th>Account</th><th>Symbol</th><th>Source</th><th>Side</th><th>Shares</th><th>Avg price</th><th>Order fees</th></tr></thead><tbody>
 {rows.map(r=><tr key={String(r.row_id)}><td>{new Date(String(r.executed_at)).toISOString().replace('T',' ').slice(0,19)}</td><td>{formatBrokerageAccount(r.account_type as string|null,String(r.external_account_id))}</td><td>{String(r.symbol)}</td><td>{r.source==='manual_trade'?'Manual':'Webull'}</td><td>{String(r.side)}</td><td>{String(r.quantity)}</td><td>{String(r.price)}</td><td>{String(r.order_fees)}</td></tr>)}
 </tbody></table></div></>}</main>;
}
