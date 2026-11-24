import {activeAccountId} from '@/lib/review/account-scope';
import Link from 'next/link';
import {reviewIsLocal,loadReviewLedger} from '@/lib/review/server';
import {buildTradeReview} from '@/lib/review/trade-review';
import {buildTimingReport,type TimingGroup} from '@/lib/review/timing-analytics';
import {easternDate} from '@/lib/review/details';
export const dynamic='force-dynamic';
type Filters={account?:string;symbol?:string;direction?:string;from?:string;to?:string};
const usd=(v:string|null)=>v===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v));
const pct=(v:number|null)=>v===null?'—':v.toFixed(1)+'%';
const factor=(v:number|null|'∞')=>v===null?'—':v==='∞'?'∞':v.toFixed(2);
function Breakdown({rows,weekday=false}:{rows:TimingGroup[];weekday?:boolean}){
 const active=rows.filter(r=>r.metrics.trades>0);
 if(!active.length)return <p className="notice">No completed trades match these filters.</p>;
 const max=Math.max(1,...active.map(r=>r.metrics.trades));
 return <div className="table-scroll"><table className="timing-table"><thead><tr>
  <th>{weekday?'Weekday':'Eastern Time bucket'}</th><th>Completed trades</th><th>Win rate</th><th>Net P&amp;L</th><th>Average net</th><th>Profit factor</th></tr></thead><tbody>
  {rows.map(r=><tr key={r.key}>
   <td><strong>{r.label}</strong></td>
   <td><div className="timing-bar-cell"><span className="timing-bar-track"><span style={{width:(r.metrics.trades/max*100)+'%'}}/></span>
    <span>{r.metrics.trades}</span></div></td>
   <td>{pct(r.metrics.winRate)}</td>
   <td className={r.metrics.verified===0?'':Number(r.metrics.net)<0?'trade-side-sell':'trade-side-buy'}>{r.metrics.verified?usd(r.metrics.net):'—'}</td>
   <td>{usd(r.metrics.average)}</td><td>{factor(r.metrics.profitFactor)}</td>
  </tr>)}
 </tbody></table></div>;
}
export default async function TimingAnalytics({searchParams}:{searchParams:Promise<Filters>}){
 if(!await reviewIsLocal())return <main className="shell"><header><Link href="/" className="brand">TRADE / JOURNAL</Link></header><p className="notice">Trade timing analytics is restricted to localhost development.</p></main>;
 const p=await searchParams;
 const account=(await activeAccountId())??'all';
 const symbol=typeof p.symbol==='string'?p.symbol.trim().replace(/^\$/,'').toUpperCase():'';
 const direction=typeof p.direction==='string'?p.direction:'all';
 const from=typeof p.from==='string'?p.from:'',to=typeof p.to==='string'?p.to:'';
 const valid=(account==='all'||/^\d{1,19}$/.test(account))&&(!symbol||/^[A-Z0-9.^_-]{1,30}$/.test(symbol))&&
  ['all','LONG','SHORT'].includes(direction)&&(!from||/^\d{4}-\d{2}-\d{2}$/.test(from))&&
  (!to||/^\d{4}-\d{2}-\d{2}$/.test(to))&&(!from||!to||from<=to);
 let report:ReturnType<typeof buildTimingReport>|null=null;
 let accounts:{id:string;label:string}[]=[];
 let error='';
 if(valid)try{
  const source=await loadReviewLedger(account==='all'?null:account);
  accounts=source.accounts.map(a=>({id:a.id,label:source.accountLabel(a.id)}));
  const completed=buildTradeReview(source.entries).trades;
  const filtered=completed.filter(t=>
   (!symbol||t.symbol.toUpperCase()===symbol)&&
   (direction==='all'||t.direction===direction)&&
   (!from||easternDate(t.exitedAt)>=from)&&(!to||easternDate(t.exitedAt)<=to));
  report=buildTimingReport(filtered);
 }catch(e){
  console.error('[Trade timing] Loading failed',e);
  error=e instanceof Error&&e.message==='LIMIT_EXCEEDED'
   ?'More than 20,000 executions; reporting stopped rather than truncating FIFO history.'
   :'Unable to load trade timing analytics. Check the Next.js terminal.';
 }
 return <main className="shell review-shell"><header><Link href="/" className="brand">TRADE / JOURNAL</Link><span className="muted">Local-only · FIFO timing analytics</span></header>
  <section className="page-title"><p className="eyebrow">TRADING PERFORMANCE</p><h1>Trade Timing Analytics</h1>
   <p className="intro">Discover which Eastern Time entry hours, exit hours and weekdays are associated with stronger completed-trade results.</p></section>
  <nav className="pill-row"><Link href="/analytics">Strategy Analytics ↗</Link><Link href="/daily">Daily Performance ↗</Link><Link href="/review">Trade Review ↗</Link></nav>
  <form action="/timing" method="get" className="performance-filter">
   <span className="helper">Account: {account==='all'?'All Accounts':accounts.find(a=>a.id===account)?.label??'Selected account'} (sidebar selection)</span>
   <label htmlFor="timing-symbol">Ticker</label><input id="timing-symbol" name="symbol" defaultValue={symbol} placeholder="NVDA" maxLength={30}/>
   <label htmlFor="timing-direction">Direction</label><select id="timing-direction" name="direction" defaultValue={direction}>
    <option value="all">All</option><option value="LONG">Long</option><option value="SHORT">Short</option></select>
   <label htmlFor="timing-from">Exit from (ET)</label><input id="timing-from" type="date" name="from" defaultValue={from}/>
   <label htmlFor="timing-to">Exit to (ET)</label><input id="timing-to" type="date" name="to" defaultValue={to}/>
   <button type="submit">Apply</button><Link href="/timing">Clear</Link>
  </form>
  {!valid?<p className="notice">Invalid account, ticker, direction or date range.</p>:error?<p className="notice">{error}</p>:report&&<>
   <div className="analytics-metrics">
    {([['Completed trades',String(report.total.trades)],['Verified net trades',String(report.total.verified)],
     ['Win rate',pct(report.total.winRate)],['Total net P&L',report.total.verified?usd(report.total.net):'—'],
     ['Average net / trade',usd(report.total.average)],['Profit factor',factor(report.total.profitFactor)],
     ['Wins / losses / flat',report.total.wins+' / '+report.total.losses+' / '+report.total.breakeven],
     ['Unverified net trades',String(report.total.unverified)]]).map(([label,value])=>
     <div key={label}><small>{label}</small><strong>{value}</strong></div>)}
   </div>
   <h2>Performance by entry hour</h2><p className="helper">The hour when the completed position cycle first opened (ET).</p><Breakdown rows={report.entryHours}/>
   <h2>Performance by exit hour</h2><p className="helper">The hour of the final exit or reversal that completed the position cycle (ET).</p><Breakdown rows={report.exitHours}/>
   <h2>Performance by entry weekday</h2><Breakdown weekday rows={report.entryWeekdays}/>
   <h2>Performance by exit weekday</h2><Breakdown weekday rows={report.exitWeekdays}/>
   <p className="notice">Each completed trade counts once in each entry and exit breakdown. Times are converted using America/New_York, including daylight saving transitions; date-range filters apply to the final exit date in ET. Partial exits from still-open positions are not counted as completed trades (see Daily Performance for realized partial-exit activity). Net P&amp;L, average P&amp;L and profit factor reuse the same verified FIFO metrics as Strategy Analytics; unknown net P&amp;L is excluded from those calculations. Hourly results describe historical associations, not forecasts; small samples can be misleading.</p>
  </>}
 </main>;
}
