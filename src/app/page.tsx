import Link from 'next/link';
import {reviewIsLocal,loadReviewLedger} from '@/lib/review/server';
import {buildTradeReview,type ReviewedTrade} from '@/lib/review/trade-review';
import {buildDashboardData,type DashboardGroup} from '@/lib/review/dashboard';
import {DashboardDailyBars} from '@/components/dashboard-daily-bars';
import {DashboardTrades} from '@/components/dashboard-trades';
import {TradingCalendar} from '@/components/trading-calendar';
import {NewTradeButton} from '@/components/new-trade-button';
import {activeAccountId} from '@/lib/review/account-scope';
export const dynamic='force-dynamic';
const money=(n:string|null)=>n===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n));
const percent=(n:number|null)=>n===null?'—':n.toFixed(1)+'%';
function MiniMetric({label,value,accent}:{label:string;value:string;accent?:string}){
 return <div className="sj-mini-metric"><div><span>{label}</span><strong style={accent?{color:accent}:undefined}>{value}</strong></div>
  <div className="sj-mini-track"><span style={{width:'65%',background:accent??'#548de0'}}/></div></div>;
}
function DashboardSummary({data}:{data:ReturnType<typeof buildDashboardData>}){
 const m=data.completed;
 return <section className="sj-dashboard-summary">
  <div className="sj-dashboard-summary-left"><p className="sj-kicker">TRADE JOURNAL / OVERVIEW</p>
   <h1>Dashboard</h1><p>Track activity and performance across your saved brokerage trades.</p>
   <div className="sj-summary-actions"><NewTradeButton>＋ Add Trade</NewTradeButton><Link href="/import">⇧ Import Trades</Link></div>
  </div>
  <div className="sj-dashboard-summary-right">
   <div className="sj-summary-mini-grid">
    <MiniMetric label="WINS" value={String(m.wins)} accent="#4acb91"/>
    <MiniMetric label="OPEN" value={String(data.openPositions)} accent="#599cff"/>
    <MiniMetric label="AVG WIN" value={m.wins?money(moneyAverage(m.grossWins,m.wins)):'—'} accent="#4acb91"/>
    <MiniMetric label="LOSSES" value={String(m.losses)} accent="#f05f84"/>
    <MiniMetric label="FLAT" value={String(m.breakeven)} accent="#e5b45c"/>
    <MiniMetric label="AVG LOSS" value={m.losses?money(moneyAverage(m.grossLosses,m.losses)):'—'} accent="#f05f84"/>
   </div>
   <div className="sj-summary-pnl"><small>Realized Net P&amp;L*</small>
    <strong className={Number(data.daily.netSubtotal)<0?'trade-side-sell':'trade-side-buy'}>
     {data.daily.verifiedDays?money(data.daily.netSubtotal):'—'}</strong>
    <span>{percent(m.winRate)} trade win rate</span>
   </div>
  </div>
 </section>;
}
function moneyAverage(n:string,count:number){return String(Number(n)/count);}
function Groups({rows}:{rows:DashboardGroup[]}){
 if(!rows.length)return <p className="dashboard-empty">No completed trades yet.</p>;
 const max=Math.max(1,...rows.map(r=>Math.abs(Number(r.net))));
 return <div className="dashboard-group-list">{rows.map(r=><div className="dashboard-group" key={r.name}>
  <div className="dashboard-group-top"><strong>{r.name}</strong><span className={Number(r.net)<0?'trade-side-sell':'trade-side-buy'}>{r.verified?money(r.net):'Unverified'}</span></div>
  <div className="dashboard-group-track"><span className={Number(r.net)<0?'dashboard-negative-track':'dashboard-positive-track'} style={{width:(Math.abs(Number(r.net))/max*100)+'%'}}/></div>
  <small>{r.count} trades · {r.verified} verified · {percent(r.winRate)} win rate</small>
 </div>)}</div>;
}
export default async function Home(){
 if(!await reviewIsLocal())return <main className="shell"><p className="notice">Dashboard data is restricted to the local development workspace.</p></main>;
 let data:ReturnType<typeof buildDashboardData>|null=null,trades:ReviewedTrade[]=[];
 let error='';
 try{
  const source=await loadReviewLedger(await activeAccountId());
  const review=buildTradeReview(source.entries);
  trades=review.trades;
  data=buildDashboardData(review.trades,review.sessions,source.accounts.length,review.openPositions.length);
 }catch(e){
  console.error('[Dashboard] Failed:',e);
  error=e instanceof Error&&e.message==='LIMIT_EXCEEDED'?'Over 20,000 executions; dashboard stopped to avoid incomplete FIFO history.':'Unable to load dashboard. Check database and server logs.';
 }
 return <main className="shell sj-dashboard-page">
  {error?<p role="alert" className="notice">{error}</p>:data&&<>
   <DashboardSummary data={data}/>
   <DashboardTrades trades={trades}/>
   <div className="sj-dashboard-below">
    <div className="sj-section-heading"><div><h2>Trading Calendar</h2><p>Realized exit activity by Eastern Time date</p></div><Link href="/calendar">Full calendar ↗</Link></div>
    <TradingCalendar days={data.daily.days} initialMonth={data.daily.days.at(-1)?.date.slice(0,7)??new Date().toISOString().slice(0,7)}/>
   </div>
   <div className="dashboard-two-up sj-dashboard-panels">
    <section className="dashboard-panel">
     <div className="dashboard-panel-head"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Daily P&amp;L</h2></div><Link href="/daily">Details ↗</Link></div>
     <DashboardDailyBars days={data.last30Days}/>
    </section>
    <section className="dashboard-panel">
     <div className="dashboard-panel-head"><div><p className="eyebrow">SYMBOL PERFORMANCE</p><h2>Top symbols by known net</h2></div><Link href="/insights">Insights ↗</Link></div>
     <Groups rows={data.symbols}/>
    </section>
   </div>
   <p className="helper sj-dashboard-disclaimer">*Known realized net subtotal includes verified FIFO exit days and partial closes. It is not account equity or a tax ledger. Unknown net days are excluded, and completed-trade metrics may differ from daily realized results.</p>
  </>}
 </main>;
}
