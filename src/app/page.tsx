import Link from 'next/link';
import {reviewIsLocal,loadReviewLedger} from '@/lib/review/server';
import {buildTradeReview} from '@/lib/review/trade-review';
import {buildDashboardData,type DashboardGroup} from '@/lib/review/dashboard';
import {DashboardDailyBars} from '@/components/dashboard-daily-bars';
import {TradingCalendar} from '@/components/trading-calendar';
export const dynamic='force-dynamic';
const money=(v:string|null)=>v===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v));
const percent=(v:number|null)=>v===null?'—':v.toFixed(1)+'%';
const factor=(v:number|null|'∞')=>v===null?'—':v==='∞'?'∞':v.toFixed(2);
function Metrics({data}:{data:ReturnType<typeof buildDashboardData>}){
 const cells=[
  ['Known realized daily net',data.daily.verifiedDays?money(data.daily.netSubtotal):'—','From verified exit days, including partial exits'],
  ['Completed trades',String(data.completed.trades),'Flat-to-flat FIFO position cycles'],
  ['Trade win rate',percent(data.completed.winRate),data.completed.verified+' trades with verified net'],
  ['Profit factor',factor(data.completed.profitFactor),'Verified completed trades'],
  ['Average completed trade',money(data.completed.average),'Verified completed trades'],
  ['Active exit days',String(data.daily.activeDays),'With realized FIFO closures'],
  ['Open positions',String(data.openPositions),'Current reconstructed FIFO positions'],
  ['Data gaps',String(data.daily.unverifiedDays)+' days · '+data.unverifiedTrades+' trades','Unknown or unverified net results']
 ];
 return <div className="dashboard-kpis">{cells.map(([label,value,hint])=><div className="dashboard-kpi" key={label}>
  <small>{label}</small><strong className={label==='Known realized daily net'&&data.daily.verifiedDays&&Number(data.daily.netSubtotal)<0?'trade-side-sell':''}>{value}</strong>
  <span>{hint}</span>
 </div>)}</div>;
}
function Groups({rows,empty}:{rows:DashboardGroup[];empty:string}){
 if(!rows.length)return <p className="dashboard-empty">{empty}</p>;
 const largest=Math.max(1,...rows.map(r=>Math.abs(Number(r.net))));
 return <div className="dashboard-group-list">{rows.map(r=><div className="dashboard-group" key={r.name}>
  <div className="dashboard-group-top"><strong>{r.name}</strong><span className={Number(r.net)<0?'trade-side-sell':'trade-side-buy'}>{r.verified?money(r.net):'Unverified'}</span></div>
  <div className="dashboard-group-track"><span className={Number(r.net)<0?'dashboard-negative-track':'dashboard-positive-track'} style={{width:(Math.abs(Number(r.net))/largest*100)+'%'}}/></div>
  <small>{r.count} completed · {r.verified} verified · {percent(r.winRate)} win rate</small>
 </div>)}</div>;
}
export default async function Home(){
 if(!await reviewIsLocal())return <main className="shell"><header><span className="brand">TRADE / JOURNAL</span></header>
  <section className="page-title"><p className="eyebrow">PRIVATE DASHBOARD</p><h1>Trading Dashboard</h1>
  <p className="intro">Trading metrics are available only on the local development server until login and authorization are implemented.</p></section></main>;
 let data:ReturnType<typeof buildDashboardData>|null=null;
 let error='';
 try{
  const source=await loadReviewLedger(null);
  const review=buildTradeReview(source.entries);
  data=buildDashboardData(review.trades,review.sessions,source.accounts.length,review.openPositions.length);
 }catch(e){
  console.error('[Dashboard] Failed to load analytics:',e);
  error=e instanceof Error&&e.message==='LIMIT_EXCEEDED'
   ?'More than 20,000 executions. Dashboard reporting stopped rather than build metrics from incomplete FIFO history.'
   :'Unable to load dashboard data. Check the Next.js terminal and database connection.';
 }
 return <main className="shell review-shell dashboard-shell">
  <header><Link href="/" className="brand">TRADE / JOURNAL</Link><span className="muted">Realized FIFO trading overview · Eastern Time</span></header>
  <section className="dashboard-intro"><div><p className="eyebrow">YOUR TRADING OVERVIEW</p><h1>Dashboard</h1>
   <p className="intro">A clear view of completed trade results, daily realized P&amp;L, trading activity, and performance across symbols.</p></div>
   <div className="dashboard-actions"><Link href="/import">Import Trades</Link><Link href="/review">Review Trades</Link></div>
  </section>
  {error?<p className="notice" role="alert">{error}</p>:!data?<p className="notice">No dashboard data could be loaded.</p>:
   data.completed.trades===0&&data.daily.activeDays===0?<section className="dashboard-empty-state">
    <h2>No realized trades yet</h2><p>Import Webull transactions or add historical trades to populate charts and metrics. Existing open positions won't show realized net P&amp;L until an exit is recorded.</p>
    <div className="pill-row"><Link href="/import">Import trades ↗</Link><Link href="/manual">Add manual trades ↗</Link><Link href="/trades">Trade history ↗</Link></div>
    <p className="helper">{data.accounts} saved brokerage account(s) · {data.openPositions} open FIFO position(s)</p>
   </section>:<>
   <Metrics data={data}/>
   <section className="dashboard-panel dashboard-calendar-panel">
    <div className="dashboard-panel-head"><div><p className="eyebrow">REALIZED DAILY RESULTS</p></div><Link href="/daily">Daily Analytics ↗</Link></div>
    <TradingCalendar days={data.daily.days} initialMonth={data.daily.days.at(-1)?.date.slice(0,7)??new Date().toISOString().slice(0,7)}/>
   </section>
   <div className="dashboard-two-up">
    <section className="dashboard-panel"><div className="dashboard-panel-head"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Daily P&amp;L</h2></div><Link href="/daily">View all ↗</Link></div>
     <DashboardDailyBars days={data.last30Days}/></section>
   </div>
   <div className="dashboard-two-up">
    <section className="dashboard-panel"><div className="dashboard-panel-head"><div><p className="eyebrow">TRADE RESULTS</p><h2>Long vs. Short</h2></div><Link href="/analytics">Strategy Analytics ↗</Link></div>
     <Groups rows={data.direction} empty="No completed trades to compare."/></section>
    <section className="dashboard-panel"><div className="dashboard-panel-head"><div><p className="eyebrow">SYMBOL BREAKDOWN</p><h2>Top symbols by known net</h2></div><Link href="/insights">Insights ↗</Link></div>
     <Groups rows={data.symbols} empty="No completed symbols yet."/></section>
   </div>
   <section className="dashboard-panel dashboard-recent"><div className="dashboard-panel-head"><div><p className="eyebrow">LATEST EXIT DAYS</p><h2>Recent trading sessions</h2></div><Link href="/review?view=sessions">All sessions ↗</Link></div>
    <div className="table-scroll"><table><thead><tr><th>Date (ET)</th><th>Symbols</th><th>FIFO closures</th><th>Accounts</th><th>Net realized P&amp;L</th></tr></thead><tbody>
     {data.recentDays.map(d=><tr key={d.date}><td>{d.date}</td><td>{d.symbols.join(', ')}</td><td>{d.closures}</td><td>{d.accounts}</td>
      <td className={d.net!==null?(Number(d.net)<0?'trade-side-sell':'trade-side-buy'):''}>{d.net===null?'Unverified':money(d.net)}</td></tr>)}
    </tbody></table></div>
   </section>
   <div className="dashboard-bottom-links"><Link href="/risk">Risk &amp; Trade Quality ↗</Link><Link href="/timing">Trade Timing ↗</Link><Link href="/performance">Realized Performance ↗</Link></div>
   <p className="notice">Provisional FIFO accounting from imported Webull order snapshots and manual trades. The trading calendar displays verified and unverified daily realized results, including partial exits of open positions. The daily known-net subtotal is not account equity. A day with any unknown net result is excluded from that subtotal, while completed-trade metrics exclude trades with unknown net P&amp;L. Symbol/direction breakdowns are completed trades only and may differ from daily realized totals. Tax adjustments, wash sales, missing historical lots and corporate actions may affect reconciliation.</p>
  </>}
 </main>;
}
