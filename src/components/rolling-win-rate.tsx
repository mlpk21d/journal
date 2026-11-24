'use client';
import {useState} from 'react';
type Point={id:string;exitedAt:string;net:string|null};
const sizes=[10,20,50,100] as const;
export function RollingWinRate({trades}:{trades:Point[]}){
 const [windowSize,setWindowSize]=useState<number>(20);
 const verified=trades.filter(t=>t.net!==null).sort((a,b)=>a.exitedAt.localeCompare(b.exitedAt)||a.id.localeCompare(b.id));
 const history=verified.map((t,i)=>{
  const from=Math.max(0,i-windowSize+1);
  const slice=verified.slice(from,i+1);
  const wins=slice.filter(x=>Number(x.net)>0).length;
  return {date:t.exitedAt,value:100*wins/slice.length};
 });
 const shown=history.slice(-120);
 const width=1000,height=240,left=32,right=980,top=20,bottom=210;
 const x=(i:number)=>left+(right-left)*i/Math.max(1,shown.length-1);
 const y=(p:number)=>bottom-(bottom-top)*p/100;
 const path=shown.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+','+y(p.value).toFixed(1)).join(' ');
 return <div className="sj-rolling">
  <div className="sj-rolling-controls" role="group" aria-label="Rolling trade window">
   {sizes.map(size=><button type="button" key={size} aria-pressed={size===windowSize} onClick={()=>setWindowSize(size)}>{size}</button>)}
  </div>
  {!shown.length?<p className="dashboard-empty">No verified closed trades yet. Rolling win rate will appear after the first completed trade with known net P&amp;L.</p>:
   <svg viewBox="0 0 1000 240" preserveAspectRatio="xMidYMid meet" role="img" aria-label={'Rolling win rate over the last '+windowSize+' verified trades'}>
    {[0,25,50,75,100].map(value=><g key={value}><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#323746" strokeDasharray="4 5"/>
     <text x="0" y={y(value)+4} fill="#818a9e" fontSize="12">{value}%</text></g>)}
    <path d={path} fill="none" stroke="#5a9eff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
    {shown.length===1&&<circle cx={left} cy={y(shown[0].value)} r="4" fill="#5a9eff"/>}
    <text x={left} y="234" fill="#8993aa" fontSize="12">{shown[0].date.slice(0,10)}</text>
    <text x={right} y="234" textAnchor="end" fill="#8993aa" fontSize="12">{shown[shown.length-1].date.slice(0,10)}</text>
   </svg>}
 </div>;
}
