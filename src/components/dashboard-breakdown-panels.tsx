import {parseFixed} from '@/lib/performance/ledger';
import type {DashboardBreakdown,TradePerformanceSummary} from '@/lib/review/dashboard-breakdown';

const currency=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
const dollars=(value:string)=>currency.format(Number(value));
const signed=(value:string)=>parseFixed(value)>0n?'+':parseFixed(value)<0n?'−':'';
const netLabel=(value:string)=>signed(value)+(parseFixed(value)<0n?dollars(value).replace('-',''):dollars(value));
const shortNet=(value:string)=>{
 const amount=Number(value);
 if(amount===0)return '$0';
 return (amount<0?'−':'')+'$'+compact.format(Math.abs(amount));
};
const percent=(value:number|null)=>value===null?'—':Math.round(value)+'%';
const enough=(data:TradePerformanceSummary)=>data.verified>0;
function LongShort({data}:{data:DashboardBreakdown['directions']}){
 return <section className="sj-breakdown-panel">
  <div className="sj-breakdown-heading">LONG VS SHORT</div>
  <div className="sj-breakdown-directions">
   {data.map(item=><div key={item.direction} className="sj-breakdown-direction">
    <div className="sj-breakdown-counter">
     <span className={'sj-direction-pill '+(item.direction==='LONG'?'sj-direction-long':'sj-direction-short')}>{item.direction}</span>
     <span>{item.trades} trades</span>
    </div>
    <strong className={'sj-direction-net '+(!enough(item)?'sj-muted-net':parseFixed(item.net)<0n?'sj-negative':'sj-positive')}>{enough(item)?netLabel(item.net):'—'}</strong>
    <div className="sj-breakdown-line"><span>Win rate</span><strong>{percent(item.winRate)}</strong></div>
    <div className="sj-breakdown-line"><span>Avg win</span><strong className="sj-positive">{item.averageWin===null?'—':dollars(item.averageWin)}</strong></div>
    <div className="sj-breakdown-line"><span>Avg loss</span><strong className="sj-negative">{item.averageLoss===null?'—':dollars(item.averageLoss)}</strong></div>
    {item.unverified>0&&<small className="sj-breakdown-unverified">{item.unverified} trade(s) excluded from known net</small>}
   </div>)}
  </div>
 </section>;
}
function Weekdays({data}:{data:DashboardBreakdown['weekdays']}){
 const max=Math.max(0,...data.map(day=>Math.abs(Number(day.net))));
 return <section className="sj-breakdown-panel">
  <div className="sj-breakdown-heading"><span>DAY OF WEEK</span><span className="sj-breakdown-subheading">When you trade</span></div>
  <div className="sj-weekdays-body">
   {data.map(day=>{
    const net=Number(day.net),negative=net<0;
    const bar=max===0?0:Math.abs(net)/max*50;
    return <div className="sj-weekday-row" key={day.day}>
     <strong className="sj-weekday-name">{day.day}</strong>
     <div className="sj-weekday-track" role="img" aria-label={day.day+': '+day.trades+' trades, '+(enough(day)?dollars(day.net)+' known net':'no verified net')}>
      <div className="sj-weekday-center"/>
      {enough(day)&&net!==0&&<span className={negative?'sj-weekday-bar sj-weekday-negative':'sj-weekday-bar sj-weekday-positive'}
       style={{width:bar+'%',...(negative?{right:'50%'}:{left:'50%'})}}/>}
     </div>
     <strong className={'sj-weekday-net '+(!enough(day)?'sj-muted-net':negative?'sj-negative':'sj-positive')}>{enough(day)?shortNet(day.net):'—'}</strong>
     <span className="sj-weekday-detail">{day.trades} · {percent(day.winRate)}</span>
    </div>;
   })}
   <p className="sj-weekday-footnote">Completed trades · verified net P&amp;L and win rate · by entry day (ET)</p>
  </div>
 </section>;
}
export function DashboardBreakdownPanels({data}:{data:DashboardBreakdown}){
 return <div className="sj-dashboard-panels sj-breakdown-grid">
  <LongShort data={data.directions}/>
  <Weekdays data={data.weekdays}/>
 </div>;
}
