import type {ReviewedTrade} from './trade-review.ts';
import {calculateMetrics,type AnalyticsMetrics,type AnalyticsTrade} from './analytics.ts';

const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] as const;
export type TimingGroup={key:string;label:string;metrics:AnalyticsMetrics};
export type TimingReport={
 total:AnalyticsMetrics;
 entryHours:TimingGroup[];exitHours:TimingGroup[];
 entryWeekdays:TimingGroup[];exitWeekdays:TimingGroup[];
};
export function etParts(iso:string){
 const date=new Date(iso);
 if(!Number.isFinite(date.getTime()))throw new Error('Invalid execution timestamp');
 const parts=new Intl.DateTimeFormat('en-US',{
  timeZone:'America/New_York',hourCycle:'h23',hour:'2-digit',minute:'2-digit',weekday:'long'
 }).formatToParts(date);
 const field=(name:string)=>parts.find(p=>p.type===name)?.value??'';
 const hour=Number(field('hour')),minute=Number(field('minute'));
 const weekday=field('weekday');
 if(!Number.isInteger(hour)||hour<0||hour>23||!Number.isInteger(minute)||minute<0||minute>59||!weekdays.some(d=>d===weekday))
  throw new Error('Invalid Eastern Time format');
 return {hour,minute,weekday};
}
const labelHour=(hour:number)=>{
 const h=hour%12||12;
 return h+':00 '+(hour<12?'AM':'PM')+' – '+(hour===23?'12':((hour+1)%12||12))+':00 '+(hour===23||hour<11?'AM':'PM')+' ET';
};
function metricRows(items:ReviewedTrade[]):AnalyticsMetrics{
 // Reuse the same precise fixed-point net P&L metrics as Strategy Analytics.
 const rows:AnalyticsTrade[]=items.map(trade=>({
  trade,strategy:'',mistake:'Not reviewed',status:'missing'
 }));
 return calculateMetrics(rows);
}
function group(items:ReviewedTrade[],select:(trade:ReviewedTrade)=>string,keys:string[],display:(key:string)=>string):TimingGroup[]{
 const grouped=new Map<string,ReviewedTrade[]>();
 for(const trade of items){
  const key=select(trade),rows=grouped.get(key)??[];
  rows.push(trade);grouped.set(key,rows);
 }
 return keys.map(key=>({key,label:display(key),metrics:metricRows(grouped.get(key)??[])}));
}
export function buildTimingReport(trades:ReviewedTrade[]):TimingReport{
 const hourlyKeys=Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
 return {
  total:metricRows(trades),
  entryHours:group(trades,t=>String(etParts(t.enteredAt).hour).padStart(2,'0'),hourlyKeys,k=>labelHour(Number(k))),
  exitHours:group(trades,t=>String(etParts(t.exitedAt).hour).padStart(2,'0'),hourlyKeys,k=>labelHour(Number(k))),
  entryWeekdays:group(trades,t=>etParts(t.enteredAt).weekday,[...weekdays],k=>k),
  exitWeekdays:group(trades,t=>etParts(t.exitedAt).weekday,[...weekdays],k=>k)
 };
}
