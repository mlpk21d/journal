import Link from 'next/link';
import {db} from '@/lib/db';
import {activeAccountId} from '@/lib/review/account-scope';
import {validTradeDate} from '@/lib/review/trade-date';
export const dynamic='force-dynamic';
type Params={symbol?:string;page?:string;date?:string};
const PAGE_SIZE=50;
const twoDecimals=(value:unknown)=>Number(value).toFixed(2);
const displayQuantity=(value:unknown)=>String(value).replace(/(\.\d*?[1-9])0+$|\.0+$/,(match,fraction:string|undefined)=>fraction??'');
export default async function Trades({searchParams}:{searchParams:Promise<Params>}){
 const params=await searchParams;
 const account=await activeAccountId();
 const rawSymbol=typeof params.symbol==='string'?params.symbol.trim().toUpperCase():'';
 const symbol=rawSymbol.replace(/^\$/,'');
 const date=typeof params.date==='string'?params.date:'';
 const pageValue=typeof params.page==='string'?params.page:'1';
 const invalid=!!symbol&&!/^[A-Z0-9.^_-]{1,30}$/.test(symbol)||!/^[1-9]\d{0,5}$/.test(pageValue)||!!date&&!validTradeDate(date);
 const page=invalid?1:Number(pageValue);
 let rows:Record<string,unknown>[]=[];let error=false;let total=0;
 if(!invalid)try{
  const sql=`FROM (
    SELECT e.id::text AS row_id,e.symbol,e.side,e.quantity::text,e.price::text,e.executed_at,e.source,e.brokerage_account_id::text AS account_id,
      COALESCE((SELECT SUM(f.amount) FROM brokerage_order_fees f WHERE f.brokerage_order_id=e.brokerage_order_id),0)::text AS order_fees
    FROM executions e WHERE ($1::text IS NULL OR UPPER(e.symbol)=$1) AND ($2::bigint IS NULL OR e.brokerage_account_id=$2::bigint)
    UNION ALL
    SELECT 'manual:'||m.id::text AS row_id,m.symbol,m.side,m.quantity::text,m.price::text,
      m.executed_at,'manual_trade'::text AS source,m.brokerage_account_id::text AS account_id,m.fees::text AS order_fees
    FROM manual_trades m WHERE ($1::text IS NULL OR UPPER(m.symbol)=$1) AND ($2::bigint IS NULL OR m.brokerage_account_id=$2::bigint)
   ) history
   WHERE ($3::date IS NULL OR (
    history.executed_at >= ($3::date::timestamp AT TIME ZONE 'America/New_York')
    AND history.executed_at < (($3::date + 1)::timestamp AT TIME ZONE 'America/New_York')
   ))`;
  const pool=db();
  const count=await pool.query<{count:string}>(`SELECT COUNT(*)::text AS count ${sql}`,[symbol||null,account,date||null]);
  total=Number(count.rows[0].count);
  const result=await pool.query(`SELECT history.* ${sql} ORDER BY executed_at DESC,row_id DESC LIMIT $4 OFFSET $5`,
   [symbol||null,account,date||null,PAGE_SIZE,(page-1)*PAGE_SIZE]);
  rows=result.rows;
 }catch(e){console.error('[Trades] History pagination failed',e);error=true;}
 const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
 const url=(n:number)=>'/trades?'+new URLSearchParams({...symbol?{symbol}:{},...date?{date}:{},page:String(n)}).toString();
 return <main className="shell"><header><Link className="brand" href="/">TRADE / JOURNAL</Link><span className="muted">Trade history</span></header>
  <section className="page-title"><p className="eyebrow">TRANSACTION HISTORY</p><h1>{date&&validTradeDate(date)?'Trades for '+date:'Trade history'}</h1>
   <p className="intro">Imported and manually entered trades, newest first, for the selected sidebar account. Dates use Eastern Time; browse all results 50 records at a time.</p>
   {date&&<Link href="/calendar">← Back to calendar</Link>}</section>
  <form action="/trades" method="get" className="performance-filter">
   <label htmlFor="trade-symbol">Ticker symbol</label><input id="trade-symbol" name="symbol" type="search" placeholder="e.g. NVDA" defaultValue={rawSymbol} maxLength={31}/>
   <label htmlFor="trade-date">Trading date (Eastern)</label><input id="trade-date" name="date" type="date" defaultValue={date}/>
   <button type="submit">Filter</button>{(symbol||date)&&<Link href="/trades">Clear filters</Link>}
  </form>
  {invalid?<p className="notice" role="alert">Invalid ticker, trading date, or page number.</p>:error?<p className="notice">Unable to load trade history. Check the server terminal.</p>:<>
   <div className="trade-pagination"><span>{total?((page-1)*PAGE_SIZE+1)+'–'+Math.min(total,page*PAGE_SIZE)+' of '+total:'0'} transaction(s) {symbol?'for '+symbol:''} · Page {page} of {pages}</span>
    <nav aria-label="Trade history pages">
     {page>1&&<Link href={url(1)}>First</Link>}{page>1&&<Link href={url(page-1)}>Previous</Link>}
     {page<pages&&<Link href={url(page+1)}>Next</Link>}{page<pages&&<Link href={url(pages)}>Last</Link>}
    </nav></div>
   {!rows.length?<p className="notice">{total?'No transactions on this page.':'No transactions yet. Import Webull orders or enter a manual trade.'}</p>:
    <div className="table-scroll"><table><thead><tr><th>Symbol</th><th>Side</th><th>Quantity</th><th>Avg Price</th><th>Fees</th><th>Filled Time (UTC)</th></tr></thead><tbody>
     {rows.map(r=><tr key={String(r.row_id)}><td>{String(r.symbol)}</td><td><span className={r.side==='BUY'?'trade-side-buy':'trade-side-sell'}>{String(r.side)}</span></td>
      <td>{displayQuantity(r.quantity)}</td><td>{twoDecimals(r.price)}</td><td>{twoDecimals(r.order_fees)}</td>
      <td>{new Date(String(r.executed_at)).toISOString().replace('T',' ').slice(0,19)}</td></tr>)}
    </tbody></table></div>}
   {pages>1&&<nav className="trade-pagination trade-pagination-bottom" aria-label="Trade history navigation">
    {page>1&&<Link href={url(page-1)}>← Previous</Link>}<span>Page {page} / {pages}</span>
    {page<pages&&<Link href={url(page+1)}>Next →</Link>}
   </nav>}
  </>}
 </main>;
}
