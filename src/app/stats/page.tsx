import Link from 'next/link';
import {reviewIsLocal,loadReviewLedger} from '@/lib/review/server';
import {buildTradeReview,type ReviewedTrade} from '@/lib/review/trade-review';
import {buildRiskReport} from '@/lib/review/risk-quality';
import {calculateMetrics,type AnalyticsTrade} from '@/lib/review/analytics';
import {summarizeDailySessions} from '@/lib/review/daily-performance';
import {RollingWinRate} from '@/components/rolling-win-rate';
import {DashboardDailyBars} from '@/components/dashboard-daily-bars';
export const dynamic='force-dynamic';
const money=(value:string|null)=>value===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value));
const percentage=(value:number|null)=>value===null?'—':value.toFixed(1)+'%';
const factor=(value:number|null|'∞')=>value===null?'—':value==='∞'?'∞':value.toFixed(2);
const duration=(ms:number|null)=>ms===null?'—':ms<3600000?Math.round(ms/60000)+' min':(ms/3600000).toFixed(1)+' hrs';
function averageHolding(trades:ReviewedTrade[],winning:boolean){
 const selected=trades.filter(t=>t.net!==null&&(winning?Number(t.net)>0:Number(t.net)<0));
 return selected.length?selected.reduce((n,t)=>n+t.durationMs,0)/selected.length:null;
}
function MetricCard({label,value,tone,detail}:{label:string;value:string;tone?:'green'|'red'|'blue';detail?:string}){
 return <div className="sj-stat-card">
  <div className="sj-stat-card-label">{label}<span title={detail??label} aria-label="Metric information">ⓘ</span></div>
  <strong className={tone?'sj-stat-'+tone:undefined}>{value}</strong>
 </div>;
}
export default async function Statistics(){
 if(!await reviewIsLocal())return <main className="shell"><p className="notice">Statistics are available in the local development workspace.</p></main>;
 let review:ReturnType<typeof buildTradeReview>|null=null;
 let error='';
 try{
  const source=await loadReviewLedger(null);
  review=buildTradeReview(source.entries);
 }catch(e){
  console.error('[Stats] Failed to load statistics',e);
  error=e instanceof Error&&e.message==='LIMIT_EXCEEDED'
   ?'More than 20,000 executions. Statistics stopped to avoid partial FIFO results.':
    'Unable to load statistics. Check the database and server logs.';
 }
 const trades=review?.trades??[];
 const summary=calculateMetrics(trades.map(trade=>({trade,strategy:'',mistake:'Not reviewed',status:'missing'} as AnalyticsTrade)));
 const risk=buildRiskReport(trades);
 const daily=summarizeDailySessions(review?.sessions??[]);
 const mostRecent=daily.days.at(-1)?.date;
 const cutoff=mostRecent?new Date(mostRecent+'T00:00:00Z'):null;
 if(cutoff)cutoff.setUTCDate(cutoff.getUTCDate()-29);
 const cutoffString=cutoff?.toISOString().slice(0,10);
 const recent=daily.days.filter(d=>!cutoffString||d.date>=cutoffString);
 return <main className="shell sj-stats-page">
  <div className="sj-page-head">
   <div><p className="sj-kicker">PERFORMANCE ANALYSIS</p><h1>Statistics</h1><p>Completed FIFO trade performance · all brokerage accounts</p></div>
   <div className="sj-head-actions"><Link href="/analytics">Strategy breakdown ↗</Link><Link href="/risk">Risk report ↗</Link></div>
  </div>
  {error?<p role="alert" className="notice">{error}</p>:<>
   <div className="sj-stats-grid">
    <MetricCard label="Known completed-trade P&L" value={summary.verified?money(summary.net):'—'} tone={Number(summary.net)<0?'red':'green'} detail="Subtotal of completed trades with verified net P&L only"/>
    <MetricCard label="Win Rate" value={percentage(summary.winRate)} tone="blue"/>
    <MetricCard label="Profit Factor" value={factor(summary.profitFactor)} tone="blue"/>
    <MetricCard label="Avg Win/Loss Ratio" value={factor(risk.payoffRatio)} detail="Average positive net trade / absolute average negative net trade"/>
    <MetricCard label="Largest Winner Share" value={percentage(risk.largestWinnerShare)} detail="Share of positive completed-trade gains from the single largest winner"/>
    <MetricCard label="Total Completed Trades" value={String(summary.trades)}/>
    <MetricCard label="Average Win" value={money(risk.averageWinner)} tone="green"/>
    <MetricCard label="Average Loss" value={money(risk.averageLoser)} tone="red"/>
    <MetricCard label="Largest Win" value={money(risk.largestWinner)} tone="green"/>
    <MetricCard label="Largest Loss" value={money(risk.largestLoser)} tone="red"/>
    <MetricCard label="Expectancy (avg net)" value={money(risk.averageNet)} tone={Number(risk.averageNet)<0?'red':'green'}/>
    <MetricCard label="Average Winning Hold" value={duration(averageHolding(trades,true))}/>
    <MetricCard label="Average Losing Hold" value={duration(averageHolding(trades,false))}/>
    <MetricCard label="Unverified Net Trades" value={String(summary.unverified)} detail="Unknown fees or unknown net results are not counted in P&L"/>
    <MetricCard label="Active Exit Days" value={String(daily.activeDays)} detail="Includes partial exits of still-open positions"/>
    <MetricCard label="Max Verified Drawdown" value={money(risk.maxVerifiedSegmentDrawdown)} tone="red" detail="Realized P&L segment drawdown, not mark-to-market equity drawdown"/>
   </div>
   <section className="sj-stat-section">
    <div className="sj-section-heading"><div><h2>Rolling win rate</h2><p>Percentage of profitable completed trades in the last N verified outcomes.</p></div><Link href="/timing">Timing details ↗</Link></div>
    <RollingWinRate trades={trades.map(t=>({id:t.id,exitedAt:t.exitedAt,net:t.net}))}/>
   </section>
   <section className="sj-stat-section">
    <div className="sj-section-heading"><div><h2>Daily realized results</h2><p>Most recent 30 calendar days with realized exit activity; partial exits included.</p></div><Link href="/calendar">Calendar ↗</Link></div>
    <DashboardDailyBars days={recent}/>
   </section>
   <section className="sj-stat-section">
    <div className="sj-section-heading"><div><h2>Trade data quality</h2><p>{summary.verified} verified net results · {summary.unverified} unknown net results</p></div></div>
    <p className="helper">Statistics are provisional. All P&amp;L metrics exclude unknown net values, and the maximum drawdown is measured across consecutive verified completed trades rather than account equity. Cash balance, Sharpe ratio, and risk-adjusted returns are not shown because the journal does not have the verified equity and cash-flow history needed to calculate them accurately.</p>
   </section>
  </>}
 </main>;
}
