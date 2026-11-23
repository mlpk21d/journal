import Link from 'next/link';
import {reviewIsLocal,loadReviewLedger} from '@/lib/review/server';
import {buildTradeReview} from '@/lib/review/trade-review';
import {summarizeDailySessions,calendarCells,type DailyPoint} from '@/lib/review/daily-performance';
import {DailyPnLChart} from '@/components/daily-pnl-chart';
export const dynamic='force-dynamic';
type Filters={account?:string;month?:string;from?:string;to?:string};
const usd=(n:string|null)=>n===null?'Unverified':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n));
function DayCalendar({month,days,account}:{month:string;days:DailyPoint[];account:string}){
 const cells=calendarCells(month,days);
 return <div className="daily-calendar">
  <div className="daily-calendar-head">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(s=><strong key={s}>{s}</strong>)}</div>
  <div className="daily-calendar-grid">{cells.map((day,i)=>day===null?<div key={'blank-'+i} className="daily-calendar-empty"/>:
   <div key={day.date} className={'daily-calendar-day '+(!day.closures?'daily-no-activity':day.net===null?'daily-unknown':Number(day.net)>0?'daily-positive':Number(day.net)<0?'daily-negative':'daily-flat')}>
    <span>{Number(day.date.slice(-2))}</span>
    {day.closures>0&&<><strong>{usd(day.net)}</strong><small>{day.closures} FIFO match{day.closures===1?'':'es'}</small>
     {account!=='all'&&<Link href={'/review/session?account='+encodeURIComponent(account)+'&date='+day.date} aria-label={'Review '+day.date+' session'}>Session ↗</Link>}</>}
   </div>)}</div>
 </div>;
}
export default async function DailyPerformance({searchParams}:{searchParams:Promise<Filters>}){
 if(!await reviewIsLocal())return <main className="shell"><header><Link className="brand" href="/">TRADE / JOURNAL</Link></header><p className="notice">Daily Performance is restricted to localhost development.</p></main>;
 const p=await searchParams;
 const account=typeof p.account==='string'?p.account:'all';
 const from=typeof p.from==='string'?p.from:'';
 const to=typeof p.to==='string'?p.to:'';
 const month=typeof p.month==='string'?p.month:'';
 const valid=(account==='all'||/^\d{1,19}$/.test(account))&&(!month||/^\d{4}-(0[1-9]|1[0-2])$/.test(month))&&
  (!from||/^\d{4}-\d{2}-\d{2}$/.test(from))&&(!to||/^\d{4}-\d{2}-\d{2}$/.test(to))&&(!from||!to||from<=to);
 let report:ReturnType<typeof summarizeDailySessions>|null=null;
 let accounts:{id:string;label:string}[]=[];
 let error='',calendarMonth=month;
 if(valid)try{
  const source=await loadReviewLedger(account==='all'?null:account);
  accounts=source.accounts.map(a=>({id:a.id,label:source.accountLabel(a.id)}));
  const all=buildTradeReview(source.entries).sessions;
  const dates=all.map(s=>s.date).sort();
  // Prefer the most recent session over the current month when the user has not selected one.
  calendarMonth=month||dates[dates.length-1]?.slice(0,7)||new Date().toISOString().slice(0,7);
  report=summarizeDailySessions(all.filter(s=>(!from||s.date>=from)&&(!to||s.date<=to)));
 }catch(e){
  console.error('[Daily Performance] Failed:',e);
  error=e instanceof Error&&e.message==='LIMIT_EXCEEDED'
   ?'More than 20,000 executions. Reporting stopped to avoid incomplete FIFO history.'
   :'Unable to load daily performance. Check the server terminal.';
 }
 return <main className="shell review-shell"><header><Link href="/" className="brand">TRADE / JOURNAL</Link><span className="muted">Local-only · Realized FIFO reporting</span></header>
  <section className="page-title"><p className="eyebrow">PERFORMANCE / DAILY</p><h1>Daily Performance</h1>
   <p className="intro">Realized P&amp;L by Eastern Time exit date, including partial exits of positions still open. Review daily consistency and consecutive winning or losing days.</p></section>
  <nav className="pill-row"><Link href="/review?view=sessions">Trading Sessions ↗</Link><Link href="/analytics">Strategy Analytics ↗</Link><Link href="/performance">Performance ↗</Link></nav>
  <form action="/daily" method="get" className="performance-filter">
   <label htmlFor="daily-account">Account</label><select id="daily-account" name="account" defaultValue={account}>
    <option value="all">All accounts</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select>
   <label htmlFor="daily-from">From (ET)</label><input id="daily-from" type="date" name="from" defaultValue={from}/>
   <label htmlFor="daily-to">To (ET)</label><input id="daily-to" type="date" name="to" defaultValue={to}/>
   <label htmlFor="daily-month">Calendar month</label><input id="daily-month" type="month" name="month" defaultValue={calendarMonth}/>
   <button type="submit">Apply</button><Link href="/daily">Clear</Link>
  </form>
  {!valid?<p className="notice">Invalid account, month or date range.</p>:error?<p className="notice">{error}</p>:report&&<>
   <div className="analytics-metrics">
    {([['Active exit days',String(report.activeDays)],['Verified / unverified',report.verifiedDays+' / '+report.unverifiedDays],
     ['Known net subtotal',usd(report.netSubtotal)],['Winning / losing / flat',report.wins+' / '+report.losses+' / '+report.flat],
     ['Best day',report.bestDay?report.bestDay.date+' · '+usd(report.bestDay.net):'—'],
     ['Worst day',report.worstDay?report.worstDay.date+' · '+usd(report.worstDay.net):'—'],
     ['Longest win streak',String(report.longestWinningStreak)+' days'],
     ['Longest loss streak',String(report.longestLosingStreak)+' days']]).map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}
   </div>
   <h2>Cumulative realized net P&amp;L</h2><DailyPnLChart days={report.days}/>
   <h2>Trading calendar · {calendarMonth}</h2><DayCalendar month={calendarMonth} days={report.days} account={account}/>
   <h2>Daily results</h2>
   {!report.days.length?<p className="notice">No realized exits in this date range.</p>:<div className="table-scroll"><table><thead><tr>
    <th>Date (ET)</th><th>Accounts</th><th>Symbols</th><th>FIFO matches</th><th>Closed shares</th>
    <th>Gross P&amp;L</th><th>Allocated fees</th><th>Net P&amp;L</th><th>Known subtotal</th></tr></thead><tbody>
    {[...report.days].reverse().map(d=><tr key={d.date}>
     <td>{d.date}</td><td>{d.accounts}</td><td>{d.symbols.join(', ')}</td><td>{d.closures}</td><td>{d.shares}</td><td>{usd(d.gross)}</td><td>{usd(d.fees)}</td>
     <td className={d.net===null?'':Number(d.net)<0?'trade-side-sell':'trade-side-buy'}>{usd(d.net)}</td><td>{usd(d.knownNetSubtotal)}</td>
    </tr>)}</tbody></table></div>}
   <p className="notice">This is a provisional FIFO realized P&amp;L report, not an account equity curve or a tax ledger. Exit activity is grouped by America/New_York calendar date and includes partial closes of open positions. A day with any unknown fees has unverified net P&amp;L, is omitted from the known-net subtotal, and interrupts streaks. Breakeven days also interrupt streaks. Missing historical lots, wash sales and corporate actions may affect reconciliation. The month selector changes the calendar only; From/To constrain all reported results.</p>
  </>}
 </main>;
}
