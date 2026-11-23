import Link from 'next/link';
import {headers} from 'next/headers';
import {db} from '@/lib/db';
import {normalizeWebullOrderFee} from '@/lib/performance/fee-policy';
import type {LedgerInput} from '@/lib/performance/ledger';
import {buildTradeReview} from '@/lib/review/trade-review';
import {formatBrokerageAccount} from '@/lib/webull/account-format';
export const dynamic='force-dynamic';
type Params={symbol?:string;account?:string;date?:string;view?:string};
const usd=(s:string|null)=>s===null?'Unverified':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(s));
const qty=(s:string)=>s.replace(/(\.\d*?[1-9])0+$|\.0+$/,(m,p:string|undefined)=>p??'');
const timestamp=(s:string)=>s.replace('T',' ').slice(0,19);
const duration=(ms:number)=>{
 const minutes=Math.floor(ms/60000);
 if(minutes<60)return minutes+'m';
 const hours=Math.floor(minutes/60);
 return hours<24?hours+'h '+minutes%60+'m':Math.floor(hours/24)+'d '+hours%24+'h';
};
const etDate=(iso:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
export default async function Review({searchParams}:{searchParams:Promise<Params>}){
 const host=(await headers()).get('host')??'';
 if(process.env.NODE_ENV!=='development'||!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host))
  return <main className="shell"><header><Link className="brand" href="/">TRADE / JOURNAL</Link></header><p className="notice">Trade Review is restricted to local development until authenticated sessions are implemented.</p></main>;
 const p=await searchParams;
 const symbol=(typeof p.symbol==='string'?p.symbol.trim().replace(/^\$/,'').toUpperCase():'');
 const account=typeof p.account==='string'?p.account:'all';
 const date=typeof p.date==='string'?p.date:'';
 const view=p.view==='sessions'?'sessions':'trades';
 const invalid=!!symbol&&!/^[A-Z0-9.^_-]{1,30}$/.test(symbol)||!!date&&!/^\d{4}-\d{2}-\d{2}$/.test(date)||account!=='all'&&!/^\d{1,19}$/.test(account);
 let accounts:{id:string;external_account_id:string;account_type:string|null}[]=[];
 let data:LedgerInput[]=[];
 let error='',truncated=false;
 if(!invalid)try{
  const pool=db();
  const a=await pool.query<{id:string;external_account_id:string;account_type:string|null}>(
   'SELECT id::text,external_account_id,account_type FROM brokerage_accounts ORDER BY id');
  accounts=a.rows;
  if(account!=='all'&&!accounts.some(a=>a.id===account))throw new Error('Unknown account');
  // Compute from full account history first. Date and ticker filters only affect display.
  const r=await pool.query<{
   id:string;account_id:string;symbol:string;side:'BUY'|'SELL';quantity:string;
   price:string;executed_at:Date;fees:string|null;
  }>([
   'SELECT * FROM (',
   'SELECT e.id::text AS id,e.brokerage_account_id::text AS account_id,',
   'e.symbol,e.side,e.quantity::text,e.price::text,e.executed_at,',
   'COALESCE((SELECT SUM(f.amount) FROM brokerage_order_fees f WHERE f.brokerage_order_id=e.brokerage_order_id),0)::text AS fees',
   "FROM executions e WHERE e.source='webull_order_snapshot' AND e.instrument_type='EQUITY'",
   'AND ($1::bigint IS NULL OR e.brokerage_account_id=$1::bigint)',
   'UNION ALL',
   "SELECT 'manual:'||m.id::text AS id,m.brokerage_account_id::text AS account_id,",
   'm.symbol,m.side,m.quantity::text,m.price::text,m.executed_at,m.fees::text',
   'FROM manual_trades m WHERE ($1::bigint IS NULL OR m.brokerage_account_id=$1::bigint)',
   ') history ORDER BY executed_at ASC,id ASC LIMIT 20001'
  ].join(' '),[account==='all'?null:account]);
  truncated=r.rows.length>20000;
  if(!truncated)data=r.rows.map(x=>({id:x.id,accountId:x.account_id,symbol:x.symbol,
   side:x.side,quantity:x.quantity,price:x.price,executedAt:x.executed_at.toISOString(),
   ...(x.id.startsWith('manual:')?{fees:x.fees??'0',feeKnown:true}:normalizeWebullOrderFee(x.fees))}));
 }catch(e){console.error('[Review] data loading failed:',e);error='Unable to load review data. Check the Next.js terminal.';}
 let review:ReturnType<typeof buildTradeReview>|null=null;
 if(!invalid&&!error&&!truncated)try{review=buildTradeReview(symbol?data.filter(row=>row.symbol.toUpperCase()===symbol):data);}catch(e){
  console.error('[Review] grouping failed:',e);error='Unable to group trades. Check the Next.js terminal.';
 }
 const name=(id:string)=>{const a=accounts.find(a=>a.id===id);return a?formatBrokerageAccount(a.account_type,a.external_account_id):'Unknown account';};
 const trades=(review?.trades??[]).filter(t=>(!symbol||t.symbol.toUpperCase()===symbol)&&(!date||etDate(t.exitedAt)===date));
 const sessions=(review?.sessions??[]).filter(s=>(!date||s.date===date)&&(!symbol||s.symbols.includes(symbol)));
 return <main className="shell"><header><Link href="/" className="brand">TRADE / JOURNAL</Link><span className="muted">Local-only · Provisional FIFO review</span></header>
  <section className="page-title"><p className="eyebrow">TRADE JOURNAL</p><h1>Trade Review</h1>
   <p className="intro">Completed flat-to-flat positions and daily realized exit activity from imported Webull order snapshots and manual trades. Raw broker transactions remain untouched.</p></section>
  <nav className="pill-row"><Link href="/trades">Transactions ↗</Link><Link href="/performance">Performance ↗</Link><Link href="/import">Import ↗</Link></nav>
  <div className="review-tabs"><Link className={view==='trades'?'review-active':''} href="/review?view=trades">Completed trades</Link><Link className={view==='sessions'?'review-active':''} href="/review?view=sessions">Trading sessions</Link></div>
  <form action="/review" method="get" className="performance-filter">
   <input type="hidden" name="view" value={view}/>
   <label htmlFor="review-symbol">Ticker</label><input id="review-symbol" name="symbol" placeholder="NVDA" defaultValue={symbol} maxLength={30}/>
   <label htmlFor="review-account">Account</label><select id="review-account" name="account" defaultValue={account}>
    <option value="all">All accounts</option>{accounts.map(a=><option key={a.id} value={a.id}>{name(a.id)}</option>)}
   </select>
   <label htmlFor="review-date">Exit date (ET)</label><input id="review-date" name="date" type="date" defaultValue={date}/>
   <button type="submit">Apply</button><Link href={'/review?view='+view}>Clear</Link>
  </form>
  {invalid?<p className="notice">Invalid ticker, account or date filter.</p>:error||truncated?<p className="notice">{error||'More than 20,000 rows. Review stopped rather than silently losing historical opening lots.'}</p>:view==='trades'?<>
   <p className="helper">{trades.length} completed trade(s). A trade closes only when the full position returns to flat or reverses. Entry/exit prices are quantity-weighted across matched FIFO shares; prices are displayed to two decimals. Time is UTC; date filtering uses Eastern Time.</p>
   {!trades.length?<p className="notice">No completed trades match these filters. Partially exited open positions may still appear in the Sessions view.</p>:
   <div className="table-scroll"><table><thead><tr><th>Ticker</th><th>Account</th><th>Direction</th><th>Quantity</th><th>Entry price</th><th>Exit price</th><th>Entry (UTC)</th><th>Exit (UTC)</th><th>Duration</th><th>Gross P&amp;L</th><th>Fees</th><th>Net P&amp;L</th></tr></thead><tbody>
    {trades.map(t=><tr key={t.id}><td><Link href={'/review/trade?id='+encodeURIComponent(t.id)}><strong>{t.symbol}</strong></Link></td><td>{name(t.accountId)}</td><td className={t.direction==='LONG'?'trade-side-buy':'trade-side-sell'}>{t.direction}</td><td>{qty(t.quantity)}</td><td>{usd(t.entryPrice)}</td><td>{usd(t.exitPrice)}</td><td>{timestamp(t.enteredAt)}</td><td>{timestamp(t.exitedAt)}</td><td>{duration(t.durationMs)}</td><td>{usd(t.gross)}</td><td>{usd(t.fees)}</td><td className={t.net!==null&&Number(t.net)<0?'trade-side-sell':'trade-side-buy'}>{usd(t.net)}</td></tr>)}
   </tbody></table></div>}
  </>:<>
   <p className="helper">{sessions.length} account session(s). Session P&amp;L is attributed to each realized exit on its Eastern Time calendar date. This includes partial exits of positions that remain open. Sessions from different accounts are not combined.</p>
   {!sessions.length?<p className="notice">No realized exit activity matches these filters.</p>:
   <div className="table-scroll"><table><thead><tr><th>Session date (ET)</th><th>Account</th><th>Symbols</th><th>FIFO closures</th><th>Closed shares</th><th>Gross P&amp;L</th><th>Fees</th><th>Net P&amp;L</th></tr></thead><tbody>
    {sessions.map(s=><tr key={s.accountId+':'+s.date}><td><Link href={'/review/session?account='+encodeURIComponent(s.accountId)+'&date='+encodeURIComponent(s.date)+(symbol?'&symbol='+encodeURIComponent(symbol):'')}>{s.date}</Link></td><td>{name(s.accountId)}</td><td>{symbol?symbol:s.symbols.join(', ')}</td><td>{s.closureCount}</td><td>{qty(s.closedShares)}</td><td>{usd(s.gross)}</td><td>{usd(s.fees)}</td><td className={s.net!==null&&Number(s.net)<0?'trade-side-sell':'trade-side-buy'}>{usd(s.net)}</td></tr>)}
   </tbody></table></div>}
  </>}
  <p className="notice">Provisional reporting, not a tax ledger. FIFO uses the same fee allocation as /performance; missing Webull fee rows count as $0. Historical orders are weighted-average snapshots, not exchange-level fills. Reversals create a new position cycle. Session closure counts represent FIFO lot matches, not necessarily individual orders. Wash sales, splits, transferred holdings and missing historical orders can affect reconciliation.</p>
 </main>;
}
