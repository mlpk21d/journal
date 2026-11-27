export const ATR_PERIOD=14;
export const ATR_MULTIPLIER=1.5;
export const BAR_MS=300000;
const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function easternClock(ms:number){
 const p=Object.fromEntries(formatter.formatToParts(ms).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day+' '+p.hour+':'+p.minute+':'+p.second;
}
export function easternBarTime(date:string):number{
 if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date))return NaN;
 const wall=Date.parse(date.replace(' ','T')+'Z');
 if(!Number.isFinite(wall))return NaN;
 for(const offset of [4,5]){
  const t=wall+offset*3600000;
  if(easternClock(t)===date)return t;
 }
 return NaN;
}
type Bar={time:number;high:number;low:number;close:number};
export function calculateIntradayAtr(raw:unknown,now=Date.now()){
 if(!Array.isArray(raw))return null;
 const bars=new Map<number,Bar>();
 for(const r of raw){
  if(!r||typeof r.date!=='string')continue;
  const time=easternBarTime(r.date);
  const {high,low,close}=r;
  if(!Number.isFinite(time)||time%BAR_MS!==0||time+BAR_MS>now||
   ![high,low,close].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0)||low>high||close<low||close>high)continue;
  bars.set(time,{time,high,low,close});
 }
 const sorted=[...bars.values()].sort((a,b)=>a.time-b.time);
 if(sorted.length<ATR_PERIOD+1)return null;
 let atr=0;
 for(let i=1;i<sorted.length;i++){
  const b=sorted[i],prev=sorted[i-1];
  const tr=Math.max(b.high-b.low,Math.abs(b.high-prev.close),Math.abs(b.low-prev.close));
  if(i<=ATR_PERIOD){atr+=tr/ATR_PERIOD;}else{atr=(atr*(ATR_PERIOD-1)+tr)/ATR_PERIOD;}
 }
 if(!Number.isFinite(atr)||atr<=0)return null;
 return {value:atr,barClosedAt:sorted[sorted.length-1].time+BAR_MS,bars:sorted.length};
}
