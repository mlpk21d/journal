import type {RiskPoint} from '@/lib/review/risk-quality';
const money=(s:string)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(s));
export function RealizedRiskChart({points}:{points:RiskPoint[]}){
 const known=points.filter(p=>p.segmentNet!==null);
 if(!known.length)return <p className="notice">No verified trade P&amp;L available to plot.</p>;
 const values=[0,...known.map(p=>Number(p.segmentNet))],low=Math.min(...values),high=Math.max(...values);
 const span=Math.max(1,high-low),left=105,right=1030,top=20,bottom=255;
 const x=(i:number)=>left+i*(right-left)/Math.max(1,points.length-1);
 const y=(n:number)=>bottom-(n-low)/span*(bottom-top);
 const segments=new Map<number,{x:number;y:number;id:string;label:string}[]>();
 points.forEach((p,i)=>{
  if(p.segmentNet===null)return;
  const list=segments.get(p.segment)??[];
  list.push({x:x(i),y:y(Number(p.segmentNet)),id:p.id,label:p.symbol+' · '+p.exitedAt+' · '+money(p.segmentNet)});
  segments.set(p.segment,list);
 });
 return <div className="risk-chart" role="img" aria-label={'Realized P&L segments for '+known.length+' verified completed trades'}>
  <svg viewBox="0 0 1050 300" preserveAspectRatio="xMidYMid meet">
   {[0,.5,1].map(level=><g key={level}>
    <line x1={left} x2={right} y1={y(low+(high-low)*level)} y2={y(low+(high-low)*level)} stroke="#2c4655" strokeDasharray="4 5"/>
    <text x="4" y={y(low+(high-low)*level)+4} fill="#b2c9d4" fontSize="12">{money(String(low+(high-low)*level))}</text>
   </g>)}
   {[...segments.entries()].map(([id,list])=><g key={id}>
    {list.length>1&&<polyline points={list.map(p=>p.x+','+p.y).join(' ')} stroke="#89cfb5" strokeWidth="3" strokeLinejoin="round" fill="none"/>}
    {list.map(p=><circle key={p.id} cx={p.x} cy={p.y} r="4" fill="#89cfb5"><title>{p.label}</title></circle>)}
   </g>)}
   {points.map((p,i)=>p.net===null?<g key={p.id}>
    <line x1={x(i)} x2={x(i)} y1={top} y2={bottom} stroke="#e2ae70" strokeDasharray="3 5"/>
    <circle cx={x(i)} cy={y(0)} r="5" fill="#e2ae70"><title>{p.symbol}: unknown net, new segment after this point</title></circle>
   </g>:null)}
   <text x={left} y="288" fill="#b2c9d4" fontSize="12">{points[0].exitedAt.slice(0,10)}</text>
   <text x={right} y="288" textAnchor="end" fill="#b2c9d4" fontSize="12">{points[points.length-1].exitedAt.slice(0,10)}</text>
  </svg>
  <p className="helper">Each green line is an uninterrupted verified-P&amp;L segment. Amber lines mark missing net values and break the drawdown sequence. Segment values are not account equity.</p>
 </div>;
}
