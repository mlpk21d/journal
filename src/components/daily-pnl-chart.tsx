import type {DailyPoint} from '@/lib/review/daily-performance';
const money=(n:string)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n));
export function DailyPnLChart({days}:{days:DailyPoint[]}){
 if(!days.length)return <p className="notice">No realized exit days match these filters.</p>;
 const values=[0,...days.map(d=>Number(d.knownNetSubtotal))];
 const min=Math.min(...values),max=Math.max(...values);
 const range=Math.max(1,max-min);
 const width=1000,height=275,top=20,bottom=240;
 const x=(i:number)=>50+i*930/Math.max(1,days.length);
 const y=(n:number)=>bottom-(n-min)/range*(bottom-top);
 const vertices=[{x:x(0),y:y(0)},...days.map((d,i)=>({x:x(i+1),y:y(Number(d.knownNetSubtotal))}))];
 const line=vertices.map((v,i)=>(i?'L':'M')+v.x.toFixed(2)+','+v.y.toFixed(2)).join(' ');
 return <div className="daily-chart" role="img" aria-label={'Cumulative known realized net P&L subtotal, '+days.length+' active days, ending at '+money(days[days.length-1].knownNetSubtotal)}>
  <svg viewBox={'0 0 '+width+' '+height} preserveAspectRatio="xMidYMid meet">
   {[0,.5,1].map(f=><g key={f}><line x1="50" x2="980" y1={y(min+(max-min)*f)} y2={y(min+(max-min)*f)} stroke="#2b4251" strokeDasharray="4 5"/>
    <text x="4" y={y(min+(max-min)*f)+4} fontSize="12" fill="#abc0cc">{money(String(min+(max-min)*f))}</text></g>)}
   <path d={line} fill="none" stroke="#8dd4bd" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
   {days.map((d,i)=><circle key={d.date} cx={x(i+1)} cy={y(Number(d.knownNetSubtotal))} r={d.complete?3.5:5}
    fill={d.complete?'#8dd4bd':'#edb768'}><title>{d.date}: {d.complete?money(d.net!):'Unverified day'} · Known subtotal {money(d.knownNetSubtotal)}</title></circle>)}
   <text x="50" y="265" fontSize="12" fill="#abc0cc">{days[0].date}</text>
   <text x="980" y="265" textAnchor="end" fontSize="12" fill="#abc0cc">{days[days.length-1].date}</text>
  </svg>
  <p className="helper">Cumulative verified-day net P&amp;L subtotal (not account equity). Amber points have unverified P&amp;L and do not change the subtotal.</p>
 </div>;
}
