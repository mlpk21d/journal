import Link from 'next/link';
import {activeAccountId} from '@/lib/review/account-scope';
import {reviewIsLocal,loadReviewLedger} from '@/lib/review/server';
import {buildTickerPnlReport,exitDateET,type TickerPnlRow} from '@/lib/review/ticker-pnl';
import {parseFixed,formatFixed} from '@/lib/performance/ledger';

export const dynamic='force-dynamic';
type Params={q?:string;ticker?:string;from?:string;to?:string;sort?:string;dir?:string;page?:string};
type Sort='symbol'|'net'|'gross'|'fees'|'completed'|'winRate'|'average'|'profitFactor'|'closures';
const SORTS:Sort[]=['symbol','net','gross','fees','completed','winRate','average','profitFactor','closures'];
const PAGE_SIZE=50;
const money=(v:string|null)=>v===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v));
const percent=(n:number|null)=>n===null?'—':n.toFixed(1)+'%';
const factor=(n:number|null|'∞')=>n===null?'—':n==='∞'?'∞':n.toFixed(2);
const color=(v:string)=>parseFixed(v)<0n?'trade-side-sell':parseFixed(v)>0n?'trade-side-buy':'';
function sortRows(rows:TickerPnlRow[],sort:Sort,dir:'asc'|'desc'){
 const output=[...rows];
 output.sort((a,b)=>{
  let result=0;
  if(sort==='symbol')result=a.symbol.localeCompare(b.symbol);
  else if(sort==='net'||sort==='gross'||sort==='fees'||sort==='average'){
   const aa=sort==='net'?a.knownNet:sort==='gross'?a.realizedGross:sort==='fees'?a.knownFees:a.averageTrade;
   const bb=sort==='net'?b.knownNet:sort==='gross'?b.realizedGross:sort==='fees'?b.knownFees:b.averageTrade;
   if(aa===null||bb===null)result=aa===bb?0:aa===null?-1:1;
   else {const an=parseFixed(aa),bn=parseFixed(bb);result=an===bn?0:an>bn?1:-1;}
  }else{
   const aa=sort==='completed'?a.completedTrades:sort==='winRate'?a.winRate:sort==='profitFactor'?(a.profitFactor==='∞'?Infinity:a.profitFactor):a.fifoClosures;
   const bb=sort==='completed'?b.completedTrades:sort==='winRate'?b.winRate:sort==='profitFactor'?(b.profitFactor==='∞'?Infinity:b.profitFactor):b.fifoClosures;
   result=aa===bb?0:aa===null?-1:bb===null?1:aa>bb?1:-1;
  }
  return (dir==='asc'?result:-result)||a.symbol.localeCompare(b.symbol);
 });
 return output;
}
function TickerTable({rows,link,sort,dir}:{rows:TickerPnlRow[];link:(next:Partial<Params>)=>string;sort:Sort;dir:'asc'|'desc'}){
 const title=(key:Sort,label:string)=><Link href={link({sort:key,dir:key===sort&&dir==='desc'?'asc':'desc',page:'1'})}
  aria-label={'Sort by '+label}>{label} {sort===key?(dir==='desc'?'↓':'↑'):'↕'}</Link>;
 return <div className="table-scroll"><table className="sj-ticker-table"><thead><tr>
  <th>{title('symbol','Ticker')}</th><th>{title('net','Known Net P&L')}</th><th>Net status</th>
  <th>{title('gross','Gross P&L')}</th><th>{title('fees','Known fees')}</th>
  <th>{title('completed','Completed')}</th><th>W / L</th><th>{title('winRate','Win rate')}</th>
  <th>{title('average','Avg completed')}</th><th>{title('profitFactor','Profit factor')}</th>
  <th>{title('closures','FIFO closes')}</th><th>Open positions</th>
 </tr></thead><tbody>{rows.map(row=><tr key={row.symbol}>
  <td><Link className="sj-ticker-symbol" href={link({ticker:row.symbol,page:'1'})}>{row.symbol}</Link></td>
  <td className={color(row.knownNet)}>{row.fifoClosures?money(row.knownNet):'—'}</td>
  <td>{row.unverifiedClosures>0?<span className="sj-ticker-warning">{row.unverifiedClosures} unverified</span>:
    row.fifoClosures?'Verified':'No exits'}</td>
  <td>{row.fifoClosures?money(row.realizedGross):'—'}</td>
  <td>{row.fifoClosures-row.unverifiedClosures?money(row.knownFees):'—'}</td>
  <td>{row.completedTrades} <small>({row.verifiedCompleted} verified)</small></td>
  <td>{row.wins} / {row.losses}</td><td>{percent(row.winRate)}</td>
  <td className={row.averageTrade===null?'':color(row.averageTrade)}>{money(row.averageTrade)}</td>
  <td>{factor(row.profitFactor)}</td><td>{row.fifoClosures}</td><td>{row.openPositions}</td>
 </tr>)}</tbody></table></div>;
}
export default async function TickerPnl({searchParams}:{searchParams:Promise<Params>}){
 if(!await reviewIsLocal())return <main className="shell"><p className="notice">P&amp;L by Ticker is available only in the localhost development workspace.</p></main>;
 const p=await searchParams;
 const q=typeof p.q==='string'?p.q.trim().replace(/^\$/,'').toUpperCase():'';
 const ticker=typeof p.ticker==='string'?p.ticker.trim().replace(/^\$/,'').toUpperCase():'';
 const from=typeof p.from==='string'?p.from:'',to=typeof p.to==='string'?p.to:'';
 const sort=SORTS.includes(p.sort as Sort)?p.sort as Sort:'net';
 const dir=p.dir==='asc'?'asc':'desc';
 const pageText=typeof p.page==='string'?p.page:'1';
 const valid=(!q||/^[A-Z0-9.^_-]{1,30}$/.test(q))&&(!ticker||/^[A-Z0-9.^_-]{1,30}$/.test(ticker))&&
  (!from||/^\d{4}-\d{2}-\d{2}$/.test(from))&&(!to||/^\d{4}-\d{2}-\d{2}$/.test(to))&&
  (!from||!to||from<=to)&&/^[1-9]\d{0,5}$/.test(pageText);
 const page=valid?Number(pageText):1;
 const link=(updates:Partial<Params>)=>{
  const params=new URLSearchParams();
  const values={q,ticker,from,to,sort,dir,page:String(page),...updates};
  for(const [key,v] of Object.entries(values))if(v&&!(key==='sort'&&v==='net')&&!(key==='dir'&&v==='desc')&&!(key==='page'&&v==='1'))params.set(key,v);
  return '/ticker-pnl'+(params.size?'?'+params.toString():'');
 };
 const selected=await activeAccountId();
 let report:ReturnType<typeof buildTickerPnlReport>|null=null;
 let accountName='All Accounts',error='';
 if(valid)try{
  const source=await loadReviewLedger(selected);
  accountName=selected?source.accountLabel(selected):'All Accounts';
  report=buildTickerPnlReport(source.entries,{from,to});
 }catch(e){
  console.error('[Ticker P&L] Failed:',e);
  error=e instanceof Error&&e.message==='LIMIT_EXCEEDED'
   ?'Over 20,000 executions; report stopped rather than calculate partial FIFO history.'
   :'Unable to load ticker P&L. Check database and application logs.';
 }
 const matches=report?.rows.filter(row=>!q||row.symbol.includes(q))??[];
 const filteredClosures=report?.matches.filter(m=>!q||m.symbol.includes(q))??[];
 const knownNetSubtotal=formatFixed(filteredClosures.reduce((sum,m)=>sum+(m.net===null?0n:parseFixed(m.net)),0n));
 const missingNetCount=filteredClosures.filter(m=>m.net===null).length;
 const sorted=sortRows(matches,sort,dir);
 const pages=Math.max(1,Math.ceil(sorted.length/PAGE_SIZE));
 const pageRows=sorted.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
 const focus=ticker?report?.rows.find(row=>row.symbol===ticker):null;
 const closures=ticker?report?.matches.filter(m=>m.symbol===ticker).sort((a,b)=>b.closedAt.localeCompare(a.closedAt))??[]:[];
 const completed=ticker?report?.trades.filter(t=>t.symbol===ticker).sort((a,b)=>b.exitedAt.localeCompare(a.exitedAt))??[]:[];
 return <main className="shell sj-ticker-page">
  <div className="sj-page-head"><div><p className="sj-kicker">REALIZED PERFORMANCE</p><h1>P&amp;L by Ticker</h1>
   <p>Every traded symbol · account-scoped FIFO exits, including partial closes of open positions.</p></div>
   <div className="sj-head-actions"><Link href="/performance">Realized Performance ↗</Link><Link href="/review">Trade Review ↗</Link></div></div>
  <form action="/ticker-pnl" method="get" className="performance-filter">
   <span className="helper">Brokerage scope: {accountName} (change in sidebar)</span>
   <label htmlFor="ticker-query">Find ticker</label><input id="ticker-query" name="q" defaultValue={q} placeholder="NVDA" maxLength={30}/>
   <label htmlFor="ticker-from">Exit from (ET)</label><input id="ticker-from" type="date" name="from" defaultValue={from}/>
   <label htmlFor="ticker-to">Exit to (ET)</label><input id="ticker-to" type="date" name="to" defaultValue={to}/>
   <button type="submit">Apply</button><Link href="/ticker-pnl">Clear</Link>
  </form>
  {!valid?<p role="alert" className="notice">Invalid ticker, date range, or page number.</p>:error?<p role="alert" className="notice">{error}</p>:report&&<>
   <div className="sj-ticker-kpis">
    <div><small>Symbols</small><strong>{matches.length}</strong></div>
    <div><small>Known net subtotal</small><strong className={color(report.knownNet)}>{filteredClosures.length?money(knownNetSubtotal):'—'}</strong></div>
    <div><small>Unverified FIFO matches</small><strong>{missingNetCount}</strong></div>
    <div><small>Net data</small><strong>{missingNetCount===0?'Verified':'Partial / unverified'}</strong></div>
   </div>
   <div className="sj-section-heading"><div><h2>Symbol performance</h2><p>{sorted.length} ticker(s) · 50 per page · click a column heading to sort</p></div></div>
   {page>pages?<p className="notice">Page {page} is beyond the available results. <Link href={link({page:'1'})}>Return to first page</Link>.</p>:
   !pageRows.length?<p className="notice">No ticker results match this selection.</p>:
   <TickerTable rows={pageRows} sort={sort} dir={dir} link={link}/>}
   {pages>1&&<nav className="sj-ticker-pagination" aria-label="Ticker results pages">
    {page>1&&<Link href={link({page:String(page-1)})}>← Previous</Link>}
    <span>Page {page} of {pages}</span>
    {page<pages&&<Link href={link({page:String(page+1)})}>Next →</Link>}
   </nav>}
   {ticker&&<section className="sj-ticker-detail">
    <div className="sj-section-heading"><div><h2>{ticker} · Ticker detail</h2>
     <p>{focus?'Realized closures and completed trade cycles':'No records for this ticker in the current account/date window.'}</p></div>
     <Link href={link({ticker:''})}>Close detail ×</Link></div>
    {focus&&<><div className="sj-ticker-detail-metrics">
      <div><small>Known realized net</small><strong className={color(focus.knownNet)}>{focus.fifoClosures?money(focus.knownNet):'—'}</strong></div>
      <div><small>Gross realized</small><strong>{money(focus.realizedGross)}</strong></div>
      <div><small>Closed shares</small><strong>{focus.closedShares}</strong></div>
      <div><small>Completed cycles</small><strong>{focus.completedTrades}</strong></div>
      <div><small>Open positions</small><strong>{focus.openPositions}</strong></div>
    </div>
    <h3>Realized FIFO exits</h3>
    {!closures.length?<p className="helper">No realized exits for this period.</p>:
     <div className="table-scroll"><table><thead><tr><th>Exit date (ET)</th><th>Direction</th><th>Shares</th><th>Gross P&amp;L</th><th>Net P&amp;L</th><th>Status</th></tr></thead><tbody>
      {closures.slice(0,100).map((m,i)=><tr key={m.sellId+':'+m.buyId+':'+i}>
       <td>{exitDateET(m.closedAt)}</td><td>{m.direction}</td><td>{m.quantity}</td>
       <td>{money(m.gross)}</td><td className={m.net===null?'':color(m.net)}>{money(m.net)}</td>
       <td>{m.net===null?'Unverified':'Known'}</td>
      </tr>)}</tbody></table></div>}
    <p className="helper">{completed.length} completed flat-to-flat cycle(s) in this exit-date window. <Link href={'/review?symbol='+encodeURIComponent(ticker)}>View {ticker} trades in Review ↗</Link></p>
    {closures.length>100&&<p className="helper">Displaying the 100 most recent FIFO matches. Adjust the exit-date filter to narrow the results.</p>}
    </>}
   </section>}
   <p className="notice">Known net P&amp;L includes realized partial exits from still-open positions. A symbol with any unknown net matches is marked unverified; its displayed net is only the known subtotal, NOT its complete profit or loss. Known fees are calculated only for verified matches, so do not subtract that column from all gross results when matches are unverified. Completed trades, win rate, average completed trade, and profit factor are calculated from finished flat-to-flat cycles; they can differ from realized-exit totals, especially across filtered date ranges. FIFO is built from full available history before date filtering. Results exclude unrealized P&amp;L, wash-sale tax adjustments and external broker corrections.</p>
  </>}
 </main>;
}
