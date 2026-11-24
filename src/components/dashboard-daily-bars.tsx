import type {DashboardData} from '@/lib/review/dashboard';
import {last30DailyBars} from '@/lib/review/dashboard';

const usd=(v:string)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(v));
export function DashboardDailyBars({days}:{days:DashboardData['last30Days']}){
 const bars=last30DailyBars(days);
 if(!bars.length)return <p className="dashboard-empty">No realized exits in the available history.</p>;
 const max=Math.max(1,...bars.filter(b=>b.amount!==null).map(b=>Math.abs(b.amount!)));
 return <div className="dashboard-bars" role="img" aria-label="Verified daily net P&L bars for active exit dates in the latest 30-calendar-day window">
  <div className="dashboard-bars-plot">
   {bars.map(b=><div key={b.date} className="dashboard-bar-day" title={b.date+': '+(b.known?usd(String(b.amount)):'Unverified')}>
    <div className="dashboard-bar-upper">
     {b.amount!==null&&b.amount>0&&<span className="dashboard-bar-positive" style={{height:(b.amount/max*100)+'%'}}/>}
     {b.amount===null&&<span className="dashboard-bar-unverified"/>}
    </div>
    <div className="dashboard-bar-axis"/>
    <div className="dashboard-bar-lower">
     {b.amount!==null&&b.amount<0&&<span className="dashboard-bar-negative" style={{height:(Math.abs(b.amount)/max*100)+'%'}}/>}
     {b.amount===0&&<span className="dashboard-bar-flat"/>}
    </div>
   </div>)}
  </div>
  <div className="dashboard-chart-labels"><span>{bars[0].date}</span><span>{bars[bars.length-1].date}</span></div>
  <p className="helper">Green = positive, red = negative, amber = unverified. Days without exits are omitted.</p>
 </div>;
}
