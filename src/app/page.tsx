import Link from 'next/link';
import {reviewIsLocal,loadReviewLedger} from '@/lib/review/server';
import {buildTradeReview,type ReviewedTrade} from '@/lib/review/trade-review';
import {buildDashboardData,type DashboardGroup} from '@/lib/review/dashboard';
import {DashboardDailyBars} from '@/components/dashboard-daily-bars';
import {DashboardTrades} from '@/components/dashboard-trades';
import {TradingCalendar} from '@/components/trading-calendar';
import {NewTradeButton} from '@/components/new-trade-button';
import {activeAccountId} from '@/lib/review/account-scope';
import {dashboardBarScales} from '@/lib/review/dashboard-metric-bars';
import {screenWashSales} from '@/lib/review/wash-sales';
export const dynamic='force-dynamic';
const money=(n:string|null)=>n===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n));
const percent=(n:number|null)=>n===null?'—':n.toFixed(1)+'%';
function MiniMetric({label,value,width,accent,title}:{label:string;value:string;width:number;accent:string;title?:string}){
 return <div className="sj-mini-metric" title={title}>
  <div><span>{label}</span><strong style={{color:accent}}>{value}</strong></div>
  <div className="sj-mini-track" role="img" aria-label={label+': '+value}>
   <span style={{width:width+'%',background:accent}}/>
  </div>
 </div>;
}
function DashboardSummary({data,washSales}:{data:ReturnType<typeof buildDashboardData>;washSales:number|null}){
 const m=data.completed;
 const winAvg=m.wins?Number(m.grossWins)/m.wins:0;
 const lossAvg=m.losses?Math.abs(Number(m.grossLosses)/m.losses):0;
 const widths=dashboardBarScales({
  wins:m.wins,losses:m.losses,open:data.openPositions,washSales:washSales??0,
  averageWin:winAvg,averageLoss:lossAvg
 });
 return <section className="sj-dashboard-summary">
  <div className="sj-dashboard-summary-left"><p className="sj-kicker">TRADE JOURNAL / OVERVIEW</p>
   <h1>Dashboard</h1><p>Track activity and performance across your saved brokerage trades.</p>
   <div className="sj-summary-actions"><NewTradeButton>＋ Add Trade</NewTradeButton><Link href="/import">⇧ Import Trades</Link></div>
  </div>
  <div className="sj-dashboard-summary-right">
   <div className="sj-summary-mini-grid">
    <MiniMetric label="WINS" value={String(m.wins)} width={widths.wins} accent="#4acb91"/>
    <MiniMetric label="OPEN" value={String(data.openPositions)} width={widths.open} accent="#599cff"/>
    <MiniMetric label="AVG WIN" value={m.wins?money(moneyAverage(m.grossWins,m.wins)):'$0.00'} width={widths.averageWin} accent="#4acb91"/>
    <MiniMetric label="LOSSES" value={String(m.losses)} width={widths.losses} accent="#f05f84"/>
    <MiniMetric label="WASH SALES" value={washSales===null?'—':String(washSales)} width={widths.washSales} accent="#e5b45c" title="Potential wash-sale loss dispositions; preliminary same-symbol cross-account screening, not tax-final"/>
    <MiniMetric label="AVG LOSS" value={m.losses?money(moneyAverage(m.grossLosses,m.losses)):'$0.00'} width={widths.averageLoss} accent="#f05f84"/>
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
 let washSales:number|null=null;
 let error='';
 try{
  const source=await loadReviewLedger(await activeAccountId());
  const review=buildTradeReview(source.entries);
  trades=review.trades;
  data=buildDashboardData(review.trades,review.sessions,source.accounts.length,review.openPositions.length);
  // Wash screening always needs all account purchases, even when displaying
  // only one account's loss sales. Keep a failure separate from Dashboard P&L.
  try{
   const selected=await activeAccountId();
   const all=selected?await loadReviewLedger(null,{ignoreWorkspaceScope:true}):source;
   const screening=screenWashSales(all.entries,
    all.accounts.map(a=>({id:a.id,label:all.accountLabel(a.id),type:[a.account_type,a.user_label].filter(Boolean).join(' ')})),
    (()=>{
     const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
     const field=(name:string)=>parts.find(p=>p.type===name)?.value??'';
     return field('year')+'-'+field('month')+'-'+field('day');
    })());
   washSales=new Set(screening.candidates.filter(c=>!selected||c.saleAccountId===selected).map(c=>c.saleAccountId+'|'+c.saleId)).size;
  }catch(e){console.error('[Dashboard] Wash-sale count unavailable:',e);}

 }catch(e){
  console.error('[Dashboard] Failed:',e);
  error=e instanceof Error&&e.message==='LIMIT_EXCEEDED'?'Over 20,000 executions; dashboard stopped to avoid incomplete FIFO history.':'Unable to load dashboard. Check database and server logs.';
 }
 return <main className="shell sj-dashboard-page">
  {error?<p role="alert" className="notice">{error}</p>:data&&<>
   <DashboardSummary data={data} washSales={washSales}/>
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
