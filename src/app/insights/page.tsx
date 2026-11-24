import Link from 'next/link';
import {db} from '@/lib/db';
import {reviewIsLocal,loadReviewLedger} from '@/lib/review/server';
import {buildTradeReview} from '@/lib/review/trade-review';
import {buildAnalytics,type AnalyticsNote} from '@/lib/review/analytics';
import {buildPerformanceInsights,DEFAULT_MIN_SAMPLE,type InsightGroup,type InsightsReport} from '@/lib/review/performance-insights';
import {easternDate} from '@/lib/review/details';

export const dynamic='force-dynamic';
type Filters={account?:string;symbol?:string;direction?:string;from?:string;to?:string;minimum?:string};
const money=(n:string|null)=>n===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n));
const pct=(n:number|null)=>n===null?'—':n.toFixed(1)+'%';
const factor=(n:number|null|'∞')=>n===null?'—':n==='∞'?'∞':n.toFixed(2);
function GroupRow({group}:{group:InsightGroup}){
 const m=group.metrics;
 return <tr>
  <td>{group.dimension}</td><td><strong>{group.label}</strong></td>
  <td>{m.trades}</td><td>{m.verified}</td><td>{pct(group.coverage*100)}</td>
  <td>{pct(m.winRate)}</td>
  <td className={m.average!==null&&Number(m.average)<0?'trade-side-sell':'trade-side-buy'}>{money(m.average)}</td>
  <td>{m.verified?money(m.net):'—'}</td><td>{factor(m.profitFactor)}</td>
  <td>{group.eligible?'Meets threshold':group.reason}</td>
 </tr>;
}
function GroupTable({rows}:{rows:InsightGroup[]}){
 if(!rows.length)return <p className="helper">No groups available for this selection.</p>;
 return <div className="table-scroll"><table className="insights-table"><thead><tr>
  <th>Category</th><th>Pattern</th><th>Trades</th><th>Verified</th><th>Coverage</th>
  <th>Win rate</th><th>Avg net</th><th>Total net</th><th>Profit factor</th><th>Sample status</th>
 </tr></thead><tbody>{rows.map(row=><GroupRow key={row.dimension+':'+row.label} group={row}/>)}</tbody></table></div>;
}
function Ranked({title,rows,empty}:{title:string;rows:InsightGroup[];empty:string}){
 return <section className="insights-rank"><h2>{title}</h2>{!rows.length?<p className="notice">{empty}</p>:
  <div className="insights-cards">{rows.map((row,index)=><article key={row.dimension+':'+row.label}>
   <small>{row.dimension} · {row.metrics.verified} verified trades</small>
   <h3>{index+1}. {row.label}</h3>
   <strong className={Number(row.metrics.average)<0?'trade-side-sell':'trade-side-buy'}>{money(row.metrics.average)} avg net</strong>
   <p>{pct(row.metrics.winRate)} win rate · {money(row.metrics.net)} total net · {factor(row.metrics.profitFactor)} profit factor</p>
  </article>)}</div>}</section>;
}
export default async function PerformanceInsights({searchParams}:{searchParams:Promise<Filters>}){
 if(!await reviewIsLocal())return <main className="shell"><header><Link className="brand" href="/">TRADE / JOURNAL</Link></header><p className="notice">Performance Insights is restricted to localhost development.</p></main>;
 const p=await searchParams;
 const account=typeof p.account==='string'?p.account:'all';
 const symbol=typeof p.symbol==='string'?p.symbol.trim().replace(/^\$/,'').toUpperCase():'';
 const direction=typeof p.direction==='string'?p.direction:'all';
 const from=typeof p.from==='string'?p.from:'';
 const to=typeof p.to==='string'?p.to:'';
 const minimumValue=typeof p.minimum==='string'?p.minimum:String(DEFAULT_MIN_SAMPLE);
 const minimum=Number(minimumValue);
 const valid=(account==='all'||/^\d{1,19}$/.test(account))&&(!symbol||/^[A-Z0-9.^_-]{1,30}$/.test(symbol))&&
  ['all','LONG','SHORT'].includes(direction)&&(!from||/^\d{4}-\d{2}-\d{2}$/.test(from))&&
  (!to||/^\d{4}-\d{2}-\d{2}$/.test(to))&&(!from||!to||from<=to)&&
  /^\d{1,3}$/.test(minimumValue)&&Number.isSafeInteger(minimum)&&minimum>=2&&minimum<=500;
 let report:InsightsReport|null=null;
 let accounts:{id:string;label:string}[]=[];
 let error='';
 if(valid)try{
  const source=await loadReviewLedger(account==='all'?null:account);
  accounts=source.accounts.map(a=>({id:a.id,label:source.accountLabel(a.id)}));
  const trades=buildTradeReview(source.entries).trades;
  const saved=(await db().query<{cycle_key:string;fingerprint:string;strategy:string;mistakes:string}>(
   'SELECT cycle_key,fingerprint,strategy,mistakes FROM trade_journal_entries')).rows;
  const notes:AnalyticsNote[]=saved.map(s=>({cycleKey:s.cycle_key,fingerprint:s.fingerprint,strategy:s.strategy,mistakes:s.mistakes}));
  // Build verified strategy associations from complete account history before filtering.
  const annotated=buildAnalytics(trades,source.entries,notes);
  const filtered=annotated.trades.filter(item=>
   (!symbol||item.trade.symbol.toUpperCase()===symbol)&&
   (direction==='all'||item.trade.direction===direction)&&
   (!from||easternDate(item.trade.exitedAt)>=from)&&
   (!to||easternDate(item.trade.exitedAt)<=to));
  report=buildPerformanceInsights(filtered,minimum);
 }catch(e){
  console.error('[Performance insights] Failed:',e);
  error=(e as {code?:string}).code==='42P01'?'Run npm run db:migrate to create the trade journal table.':
   (e instanceof Error&&e.message==='LIMIT_EXCEEDED'?'More than 20,000 executions; insights stopped rather than truncate FIFO history.':
    'Unable to load performance insights. Check the Next.js terminal.');
 }
 const eligible=report?.groups.filter(g=>g.eligible)??[];
 const thin=report?.groups.filter(g=>!g.eligible)??[];
 return <main className="shell review-shell"><header><Link href="/" className="brand">TRADE / JOURNAL</Link><span className="muted">Local-only · Historical pattern research</span></header>
  <section className="page-title"><p className="eyebrow">PERFORMANCE / INSIGHTS</p><h1>Trading Performance Insights</h1>
   <p className="intro">Compare completed-trade outcomes across strategies, direction, entry/exit hours, and weekdays. Small samples are excluded from rankings.</p></section>
  <nav className="pill-row"><Link href="/analytics">Strategy Analytics ↗</Link><Link href="/timing">Trade Timing ↗</Link><Link href="/daily">Daily Performance ↗</Link><Link href="/review">Trade Review ↗</Link></nav>
  <form action="/insights" method="get" className="performance-filter">
   <label htmlFor="insight-account">Account</label><select id="insight-account" name="account" defaultValue={account}>
    <option value="all">All accounts</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select>
   <label htmlFor="insight-symbol">Ticker</label><input id="insight-symbol" name="symbol" maxLength={30} defaultValue={symbol} placeholder="NVDA"/>
   <label htmlFor="insight-direction">Direction</label><select id="insight-direction" name="direction" defaultValue={direction}>
    <option value="all">All</option><option value="LONG">Long</option><option value="SHORT">Short</option></select>
   <label htmlFor="insight-from">Exit from (ET)</label><input id="insight-from" name="from" type="date" defaultValue={from}/>
   <label htmlFor="insight-to">Exit to (ET)</label><input id="insight-to" name="to" type="date" defaultValue={to}/>
   <label htmlFor="insight-min">Minimum verified trades</label><input id="insight-min" name="minimum" type="number" min="2" max="500" step="1" defaultValue={minimumValue}/>
   <button type="submit">Apply</button><Link href="/insights">Clear</Link>
  </form>
  {!valid?<p className="notice">Invalid account, ticker, direction, date range or minimum sample (2–500).</p>:error?<p className="notice">{error}</p>:report&&<>
   <div className="analytics-metrics">
    {([['Completed trades',String(report.totalTrades)],['Verified net trades',String(report.overall.verified)],
     ['Overall average net',money(report.overall.average)],['Overall win rate',pct(report.overall.winRate)],
     ['Qualified groups',String(report.qualifying)],['Below threshold',String(report.insufficient)],
     ['Verified journal notes',String(report.verifiedNotes)],['Unreviewed / stale notes',report.unreviewedNotes+' / '+report.staleNotes]]).map(([label,value])=>
     <div key={label}><small>{label}</small><strong>{value}</strong></div>)}
   </div>
   <p className="helper">A ranked group needs at least {minimum} verified completed trades and at least 80% verified net P&amp;L coverage. Rankings are based on average net P&amp;L per verified trade, not total dollars. Only fingerprint-matched journal notes qualify for named strategy groups.</p>
   <Ranked title="Highest historical average net P&L" rows={report.strongest} empty="At least two groups must meet the sample and data-quality thresholds before relative rankings appear."/>
   <Ranked title="Lowest historical average net P&L" rows={report.weakest} empty="There are not enough distinct qualified groups to identify a separate lower-ranked pattern."/>
   <h2>Qualified pattern comparisons</h2><GroupTable rows={eligible}/>
   <h2>Needs more evidence</h2><p className="helper">These groups remain visible for context but cannot be ranked as stronger or weaker historical patterns.</p><GroupTable rows={thin}/>
   <p className="notice">These are descriptive historical comparisons, not predictive trading recommendations. The same completed trade may appear in several categories, so ranked groups are overlapping samples, not independent edges. Filtering and comparing many groups can produce misleading apparent winners; verify patterns on later, out-of-sample trades. This dashboard uses the unchanged FIFO calculation and excludes unknown net P&amp;L from financial metrics. Open positions and partial exits that have not completed a trade are excluded. Review Daily Performance for partial-exit activity. No tax or wash-sale adjustments are made.</p>
  </>}
 </main>;
}
