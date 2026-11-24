import Link from 'next/link';
import {reviewIsLocal,loadReviewLedger} from '@/lib/review/server';
import {buildTradeReview} from '@/lib/review/trade-review';
import {easternDate} from '@/lib/review/details';
import {buildRiskReport,type DurationGroup} from '@/lib/review/risk-quality';
import {RealizedRiskChart} from '@/components/realized-risk-chart';
export const dynamic='force-dynamic';
type Filters={account?:string;symbol?:string;direction?:string;from?:string;to?:string};
const money=(n:string|null)=>n===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n));
const pct=(n:number|null)=>n===null?'—':n.toFixed(1)+'%';
const ratio=(n:number|null)=>n===null?'—':n.toFixed(2);
function DurationTable({rows}:{rows:DurationGroup[]}){
 return <div className="table-scroll"><table className="risk-duration-table"><thead><tr>
  <th>Position duration</th><th>Completed</th><th>Verified</th><th>Winners</th><th>Losers</th>
  <th>Breakeven</th><th>Win rate</th><th>Net subtotal</th><th>Avg net/trade</th></tr></thead><tbody>
  {rows.map(row=><tr key={row.key}><td><strong>{row.label}</strong></td><td>{row.trades}</td><td>{row.verified}</td>
   <td>{row.wins}</td><td>{row.losses}</td><td>{row.flat}</td><td>{pct(row.winRate)}</td>
   <td className={Number(row.net)<0?'trade-side-sell':'trade-side-buy'}>{row.verified?money(row.net):'—'}</td>
   <td>{money(row.average)}</td></tr>)}
 </tbody></table></div>;
}
export default async function RiskQualityPage({searchParams}:{searchParams:Promise<Filters>}){
 if(!await reviewIsLocal())return <main className="shell"><header><Link href="/" className="brand">TRADE / JOURNAL</Link></header><p className="notice">Risk and Trade Quality is restricted to local development.</p></main>;
 const p=await searchParams;
 const account=typeof p.account==='string'?p.account:'all';
 const symbol=typeof p.symbol==='string'?p.symbol.trim().replace(/^\$/,'').toUpperCase():'';
 const direction=typeof p.direction==='string'?p.direction:'all';
 const from=typeof p.from==='string'?p.from:'',to=typeof p.to==='string'?p.to:'';
 const valid=(account==='all'||/^\d{1,19}$/.test(account))&&(!symbol||/^[A-Z0-9.^_-]{1,30}$/.test(symbol))&&
  ['all','LONG','SHORT'].includes(direction)&&(!from||/^\d{4}-\d{2}-\d{2}$/.test(from))&&
  (!to||/^\d{4}-\d{2}-\d{2}$/.test(to))&&(!from||!to||from<=to);
 let report:ReturnType<typeof buildRiskReport>|null=null;
 let accounts:{id:string;label:string}[]=[];
 let error='';
 if(valid)try{
  const source=await loadReviewLedger(account==='all'?null:account);
  accounts=source.accounts.map(a=>({id:a.id,label:source.accountLabel(a.id)}));
  const trades=buildTradeReview(source.entries).trades;
  report=buildRiskReport(trades.filter(t=>
   (!symbol||t.symbol.toUpperCase()===symbol)&&
   (direction==='all'||t.direction===direction)&&
   (!from||easternDate(t.exitedAt)>=from)&&(!to||easternDate(t.exitedAt)<=to)));
 }catch(e){
  console.error('[Risk Quality] Failed',e);
  error=e instanceof Error&&e.message==='LIMIT_EXCEEDED'
   ?'Over 20,000 executions. Reporting stopped to protect FIFO accuracy.'
   :'Unable to load risk analytics. Check the Next.js terminal.';
 }
 return <main className="shell review-shell"><header><Link href="/" className="brand">TRADE / JOURNAL</Link><span className="muted">Local-only · Completed trades</span></header>
  <section className="page-title"><p className="eyebrow">PERFORMANCE / RISK</p><h1>Risk &amp; Trade Quality</h1>
   <p className="intro">Understand the size of your winners and losers, consecutive losses, realized P&amp;L drawdowns and which holding durations have worked historically.</p></section>
  <nav className="pill-row"><Link href="/insights">Performance Insights ↗</Link><Link href="/review">Trade Review ↗</Link><Link href="/daily">Daily Performance ↗</Link></nav>
  <form action="/risk" method="get" className="performance-filter">
   <label htmlFor="risk-account">Account</label><select id="risk-account" name="account" defaultValue={account}>
    <option value="all">All accounts</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select>
   <label htmlFor="risk-symbol">Ticker</label><input id="risk-symbol" name="symbol" defaultValue={symbol} placeholder="NVDA" maxLength={30}/>
   <label htmlFor="risk-direction">Direction</label><select id="risk-direction" name="direction" defaultValue={direction}>
    <option value="all">All</option><option value="LONG">Long</option><option value="SHORT">Short</option></select>
   <label htmlFor="risk-from">Exit from (ET)</label><input id="risk-from" type="date" name="from" defaultValue={from}/>
   <label htmlFor="risk-to">Exit to (ET)</label><input id="risk-to" type="date" name="to" defaultValue={to}/>
   <button type="submit">Apply</button><Link href="/risk">Clear</Link>
  </form>
  {!valid?<p className="notice">Invalid account, ticker, direction or exit date range.</p>:error?<p className="notice">{error}</p>:report&&<>
   <div className="analytics-metrics">
    {([['Completed trades',String(report.trades)],['Verified / unknown net',report.verified+' / '+report.unverified],
     ['Average winner',money(report.averageWinner)],['Average loser',money(report.averageLoser)],
     ['Payoff ratio',ratio(report.payoffRatio)],['Average net trade',money(report.averageNet)],
     ['Longest losing streak',String(report.longestLosingStreak)],['Current losing streak',String(report.currentLosingStreak)],
     ['Largest winner',money(report.largestWinner)],['Largest loser',money(report.largestLoser)],
     ['Largest winner share of gains',pct(report.largestWinnerShare)],['Max verified-segment drawdown',money(report.maxVerifiedSegmentDrawdown)]]).map(([label,value])=>
     <div key={label}><small>{label}</small><strong>{value}</strong></div>)}
   </div>
   <h2>Realized P&amp;L and drawdown segments</h2>
   <RealizedRiskChart points={report.points}/>
   <h2>Profitability by holding duration</h2><DurationTable rows={report.durations}/>
   <p className="notice">All metrics use completed flat-to-flat FIFO trade cycles, not individual order fills. Average winner is mean positive net P&amp;L; average loser is mean negative net P&amp;L; payoff ratio is average winner divided by the absolute average loser. “Largest winner share” measures how much of the sum of positive net trades came from one trade, not how much of total net profit it explains. The drawdown shown is the maximum peak-to-trough decline in realized P&amp;L within contiguous verified-net trade segments; it is not market-to-market equity drawdown. Unknown net trades are excluded from financial statistics and break drawdown and streak sequences. A breakeven interrupts losing streaks. Exits on still-open positions are not included here; see Daily Performance. Filter windows change the observed sequence and reset drawdown at the start of the filtered trades. Provisional reporting only: no wash-sale or tax-basis adjustments.</p>
  </>}
 </main>;
}
