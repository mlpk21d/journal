const ET='America/New_York';
const fields=(date:Date)=>{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:ET,year:'numeric',month:'2-digit',
  day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const get=(name:string)=>Number(parts.find(p=>p.type===name)?.value);
 return {y:get('year'),m:get('month'),d:get('day'),h:get('hour'),min:get('minute'),s:get('second')};
};
const localDay=(date:Date)=>{
 const {y,m,d}=fields(date);
 return [y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
};
/** Return UTC instant corresponding to 00:00 Eastern for a YYYY-MM-DD.
 * Iterate because the New York DST offset can change during a calendar day.
 */
function midnightET(ymd:string):string{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(ymd))throw new Error('Invalid Eastern date');
 const [y,m,d]=ymd.split('-').map(Number);
 const expected=Date.UTC(y,m-1,d);
 if(new Date(expected).toISOString().slice(0,10)!==ymd)throw new Error('Invalid calendar date');
 let instant=expected;
 for(let i=0;i<4;i++){
  const actual=fields(new Date(instant));
  const local=Date.UTC(actual.y,actual.m-1,actual.d,actual.h,actual.min,actual.s);
  const delta=expected-local;
  if(delta===0)return new Date(instant).toISOString();
  instant+=delta;
 }
 throw new Error('Could not resolve Eastern midnight');
}
/** Exact New York calendar day, DST-aware, as a half-open UTC range. */
export function todayEasternRange(now:Date=new Date()){
 const date=localDay(now);
 const next=new Date(Date.parse(date+'T00:00:00.000Z')+86400000).toISOString().slice(0,10);
 return {date,start:midnightET(date),end:midnightET(next)};
}
