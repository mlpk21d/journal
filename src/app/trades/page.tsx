import Link from 'next/link';
import {db} from '@/lib/db';
export const dynamic='force-dynamic';

type Params={symbol?:string};
const twoDecimals=(value:unknown)=>Number(value).toFixed(2);
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
   const r=await db().query(`SELECT history.* FROM (
    SELECT e.id::text AS row_id,e.symbol,e.side,e.quantity::text,e.price::text,e.executed_at,e.source,e.brokerage_account_id::text AS account_id,
      COALESCE((SELECT SUM(f.amount) FROM brokerage_order_fees f WHERE f.brokerage_order_id=e.brokerage_order_id),0)::text AS order_fees
    FROM executions e
    WHERE ($1::text IS NULL OR UPPER(e.symbol)=$1)
    UNION ALL
    SELECT 'manual:'||m.id::text AS row_id,m.symbol,m.side,m.quantity::text,m.price::text,
      m.executed_at,'manual_trade'::text AS source,m.brokerage_account_id::text AS account_id,m.fees::text AS order_fees
    FROM manual_trades m
    WHERE ($1::text IS NULL OR UPPER(m.symbol)=$1)
   ) history
   ORDER BY executed_at DESC,row_id DESC LIMIT 100`,[symbol||null]);
   rows=r.rows;
  }catch(e){console.error('[Trades] History query failed:',e);error=true;}
 }
 return <main className="shell"><header><Link className="brand" href="/">TRADE / JOURNAL</Link><span className="muted">Trade history</span></header>
 <section className="page-title"><p className="eyebrow">TRANSACTION HISTORY</p><h1>Trade history</h1>
 <p className="intro">Review Webull completed-order snapshots and manual stock trades. Use the ticker filter to inspect a symbol; average prices and fees are displayed to two decimal places.</p></section>
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
 <div className="table-scroll"><table><thead><tr><th>Symbol</th><th>Side</th><th>Quantity</th><th>Avg Price</th><th>Fees</th><th>Filled Time (UTC)</th></tr></thead><tbody>
 {rows.map(r=><tr key={String(r.row_id)}><td>{String(r.symbol)}</td><td><span className={r.side==='BUY'?'trade-side-buy':'trade-side-sell'}>{String(r.side)}</span></td><td>{String(r.quantity)}</td><td>{twoDecimals(r.price)}</td><td>{twoDecimals(r.order_fees)}</td><td>{new Date(String(r.executed_at)).toISOString().replace('T',' ').slice(0,19)}</td></tr>)}
 </tbody></table></div></>}</main>;
}
