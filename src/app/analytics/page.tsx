import Link from 'next/link';
import {db} from '@/lib/db';
import {reviewIsLocal,loadReviewLedger} from '@/lib/review/server';
import {buildTradeReview} from '@/lib/review/trade-review';
import {buildAnalytics,summarizeAnalytics,type AnalyticsGroup,type AnalyticsMetrics,type AnalyticsNote} from '@/lib/review/analytics';
import {easternDate} from '@/lib/review/details';
export const dynamic='force-dynamic';
type Filters={symbol?:string;account?:string;direction?:string;from?:string;to?:string;strategy?:string};
const usd=(v:string|null)=>v===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v));
const pct=(v:number|null)=>v===null?'—':v.toFixed(1)+'%';
const pf=(v:number|null|'∞')=>v===null?'—':v==='∞'?'∞':v.toFixed(2);
function GroupTable({rows}:{rows:AnalyticsGroup[]}){
 if(!rows.length)return <p className="notice">No completed trades match this selection.</p>;
 return <div className="table-scroll"><table className="analytics-table"><thead><tr><th>Group</th><th>Completed</th><th>Verified P&amp;L</th><th>Wins</th><th>Losses</th><th>Breakeven</th><th>Win rate</th><th>Net P&amp;L</th><th>Average net</th><th>Profit factor</th></tr></thead><tbody>
  {rows.map(r=><tr key={r.label}><td><strong>{r.label}</strong></td><td>{r.metrics.trades}</td><td>{r.metrics.verified}</td><td>{r.metrics.wins}</td><td>{r.metrics.losses}</td><td>{r.metrics.breakeven}</td><td>{pct(r.metrics.winRate)}</td><td className={Number(r.metrics.net)<0?'trade-side-sell':'trade-side-buy'}>{usd(r.metrics.net)}</td><td>{usd(r.metrics.average)}</td><td>{pf(r.metrics.profitFactor)}</td></tr>)}
 </tbody></table></div>;
}
function Overview({m}:{m:AnalyticsMetrics}){
 const cells=[['Completed trades',String(m.trades)],['Verified P&L trades',String(m.verified)],['Win rate',pct(m.winRate)],
  ['Net realized P&L',usd(m.net)],['Avg net per trade',usd(m.average)],['Profit factor',pf(m.profitFactor)],
  ['Wins / losses / flat',m.wins+' / '+m.losses+' / '+m.breakeven],['Unverified P&L',String(m.unverified)]];
 return <div className="analytics-metrics">{cells.map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>;
}
export default async function Analytics({searchParams}:{searchParams:Promise<Filters>}){
 if(!await reviewIsLocal())return <main className="shell"><header><Link className="brand" href="/">TRADE / JOURNAL</Link></header><p className="notice">Strategy analytics is restricted to localhost development.</p></main>;
 const p=await searchParams;
 const symbol=typeof p.symbol==='string'?p.symbol.trim().replace(/^\$/,'').toUpperCase():'';
 const account=typeof p.account==='string'?p.account:'all';
 const direction=typeof p.direction==='string'?p.direction:'all';
 const from=typeof p.from==='string'?p.from:'';
 const to=typeof p.to==='string'?p.to:'';
 const strategy=typeof p.strategy==='string'?p.strategy:'all';
 const valid=(!symbol||/^[A-Z0-9.^_-]{1,30}$/.test(symbol))&&(account==='all'||/^\d{1,19}$/.test(account))&&
  ['all','LONG','SHORT'].includes(direction)&&(!from||/^\d{4}-\d{2}-\d{2}$/.test(from))&&
  (!to||/^\d{4}-\d{2}-\d{2}$/.test(to))&&(!from||!to||from<=to)&&strategy.length<=120;
 let report:ReturnType<typeof buildAnalytics>|null=null;
 let accounts:{id:string;name:string}[]=[];
 let strategies:string[]=[];
 let error='';
 if(valid)try{
  const source=await loadReviewLedger(account==='all'?null:account);
  accounts=source.accounts.map(a=>({id:a.id,name:source.accountLabel(a.id)}));
  const trades=buildTradeReview(source.entries).trades;
  const rows=(await db().query<{cycle_key:string;fingerprint:string;strategy:string;mistakes:string}>(
   'SELECT cycle_key,fingerprint,strategy,mistakes FROM trade_journal_entries')).rows;
  const notes:AnalyticsNote[]=rows.map(r=>({cycleKey:r.cycle_key,fingerprint:r.fingerprint,strategy:r.strategy,mistakes:r.mistakes}));
  const whole=buildAnalytics(trades,source.entries,notes);
  strategies=[...new Set(whole.trades.map(t=>t.strategy))].sort();
  report=summarizeAnalytics(whole.trades.filter(t=>
   (!symbol||t.trade.symbol.toUpperCase()===symbol)&&
   (direction==='all'||t.trade.direction===direction)&&
   (!from||easternDate(t.trade.exitedAt)>=from)&&(!to||easternDate(t.trade.exitedAt)<=to)&&
   (strategy==='all'||t.strategy===strategy)));
 }catch(e){
  console.error('[Strategy analytics] Failed:',e);
  error=(e as {code?:string}).code==='42P01'?'Run npm run db:migrate to create trade journal tables.':
   (e instanceof Error&&e.message==='LIMIT_EXCEEDED'?'More than 20,000 executions. Analytics stopped rather than truncating FIFO history.':
    'Unable to load strategy analytics. Check the server terminal.');
 }
 return <main className="shell review-shell"><header><Link className="brand" href="/">TRADE / JOURNAL</Link><span className="muted">Local-only · FIFO analytics</span></header>
  <section className="page-title"><p className="eyebrow">TRADING PERFORMANCE</p><h1>Strategy Analytics</h1>
   <p className="intro">Win rate, net P&amp;L, average trade and profit factor for completed positions, grouped by strategy, direction and mistake documentation.</p></section>
  <nav className="pill-row"><Link href="/review">Trade Review ↗</Link><Link href="/performance">Performance ↗</Link></nav>
  <form action="/analytics" method="get" className="performance-filter">
   <label htmlFor="analytics-symbol">Ticker</label><input id="analytics-symbol" name="symbol" defaultValue={symbol} placeholder="NVDA" maxLength={30}/>
   <label htmlFor="analytics-account">Account</label><select id="analytics-account" name="account" defaultValue={account}>
    <option value="all">All accounts</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
   </select>
   <label htmlFor="analytics-direction">Direction</label><select id="analytics-direction" name="direction" defaultValue={direction}>
    <option value="all">All</option><option value="LONG">Long</option><option value="SHORT">Short</option></select>
   <label htmlFor="analytics-from">Exit from (ET)</label><input id="analytics-from" type="date" name="from" defaultValue={from}/>
   <label htmlFor="analytics-to">Exit to (ET)</label><input id="analytics-to" type="date" name="to" defaultValue={to}/>
   <label htmlFor="analytics-strategy">Strategy</label><select id="analytics-strategy" name="strategy" defaultValue={strategy}>
    <option value="all">All strategies</option>{strategies.map(s=><option key={s} value={s}>{s}</option>)}
    {strategy!=='all'&&!strategies.includes(strategy)&&<option value={strategy}>{strategy}</option>}
   </select>
   <button type="submit">Apply</button><Link href="/analytics">Clear</Link>
  </form>
  {!valid?<p className="notice">Invalid ticker, account, direction or date range.</p>:error?<p className="notice">{error}</p>:report&&<>
   <Overview m={report.overall}/>
   <p className="helper">Journal status: {report.annotated} verified, {report.unreviewed} unreviewed, {report.stale} changed history. Only completed trades are counted. Partial realized exits of still-open positions remain in the sessions review.</p>
   <h2>By strategy</h2><GroupTable rows={report.byStrategy}/>
   <h2>By direction</h2><GroupTable rows={report.byDirection}/>
   <h2>By mistake documentation</h2><GroupTable rows={report.byMistake}/>
   <p className="notice">Win rate = winning trades divided by completed trades with verified net P&amp;L; breakeven trades count in the denominator. Profit factor = total positive net P&amp;L divided by absolute total negative net P&amp;L; ∞ means wins without losses. Trades with unknown net P&amp;L are excluded from financial metrics. Unreviewed and changed-history notes are never assigned to a named strategy. “None recorded” means the mistakes field is empty, not that the trade was flawless. FIFO performance is provisional and is not a tax ledger.</p>
  </>}
 </main>;
}
