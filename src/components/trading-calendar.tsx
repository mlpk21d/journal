'use client';
import Link from 'next/link';
import './trading-calendar.css';
import {useState} from 'react';
import {calendarCells,type DailyPoint} from '@/lib/review/daily-performance';
import {calendarMonthLabel,shiftCalendarMonth,validCalendarMonth} from '@/lib/review/calendar-navigation';
const money=(n:string|null)=>n===null?'Unverified':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n));
const currentMonthET=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit'}).formatToParts(new Date());
 const field=(type:string)=>parts.find(p=>p.type===type)?.value??'';
 return field('year')+'-'+field('month');
};
const sumKnown=(days:DailyPoint[])=>days.filter(d=>d.net!==null&&d.closures>0).reduce((sum,d)=>sum+Number(d.net),0);
export function TradingCalendar({days,initialMonth,account='all',expanded=false}:{
 days:DailyPoint[];initialMonth:string;account?:string;expanded?:boolean
}){
 const [month,setMonth]=useState(initialMonth);
 const cells=calendarCells(month,days);
 const active=days.filter(d=>d.date.startsWith(month));
 const verified=active.filter(d=>d.net!==null).length;
 const total=sumKnown(active);
 const weeks:Array<Array<DailyPoint|null>>=[];
 for(let i=0;i<cells.length;i+=7){
  const week=cells.slice(i,i+7);
  while(week.length<7)week.push(null);
  weeks.push(week);
 }
 return <section className={'trading-calendar'+(expanded?' trading-calendar-expanded':'')}>
  <div className="trading-calendar-toolbar">
   <div className="trading-calendar-nav" role="group" aria-label="Trading calendar month navigation">
    <button type="button" onClick={()=>setMonth(m=>shiftCalendarMonth(m,-1))} aria-label="Previous month" title="Previous month">‹</button>
    <label className="trading-calendar-month-label" htmlFor="trading-calendar-month">{calendarMonthLabel(month)}</label>
    <input id="trading-calendar-month" type="month" value={month} aria-label="Choose trading calendar month" onChange={e=>{
      if(validCalendarMonth(e.target.value))setMonth(e.target.value);
    }}/>
    <button type="button" onClick={()=>setMonth(m=>shiftCalendarMonth(m,1))} aria-label="Next month" title="Next month">›</button>
    <button type="button" className="trading-calendar-today" onClick={()=>setMonth(currentMonthET())}>Today</button>
   </div>
   <div className="trading-calendar-summary">
    <span>Month realized P&amp;L</span><strong className={total<0?'trade-side-sell':'trade-side-buy'}>{verified?money(String(total)):'—'}</strong>
    {active.length>verified&&<small>{active.length-verified} unverified day{active.length-verified===1?'':'s'}</small>}
   </div>
  </div>
  <div className="trading-calendar-weekdays">
   {['SUN','MON','TUE','WED','THU','FRI','SAT',...(expanded?['WEEK']:[])].map(d=><strong key={d}>{d}</strong>)}
  </div>
  <div className="trading-calendar-weeks">
   {weeks.map((week,i)=>{
    const weekDays=week.filter((d):d is DailyPoint=>d!==null&&d.closures>0);
    const missing=weekDays.some(d=>d.net===null);
    const weeklyTotal=sumKnown(weekDays);
    return <div key={month+'-'+i} className="trading-calendar-week">
     {week.map((day,index)=>day===null?<div key={'blank-'+index} className="daily-calendar-day sj-calendar-outside"/>:
      <div key={day.date} className={'daily-calendar-day '+(!day.closures?'daily-no-activity':day.net===null?'daily-unknown':Number(day.net)>0?'daily-positive':Number(day.net)<0?'daily-negative':'daily-flat')}>
       {day.closures>0&&<Link className="calendar-day-link" href={'/trades?date='+day.date} aria-label={'View all trades for '+day.date+(account==='all'?' across all accounts':' in selected account')}/>}
       <span className="sj-calendar-date">{Number(day.date.slice(-2))}</span>
       {day.closures>0&&<><strong>{money(day.net)}</strong><small>{day.symbols.join(', ')||day.closures+' closes'}</small>
        <span className="calendar-day-hint" aria-hidden="true">View trades ↗</span></>}
      </div>)}
     {expanded&&<div className="sj-calendar-week-total"><small>WEEK</small>
       <strong className={weeklyTotal<0?'trade-side-sell':'trade-side-buy'}>{weekDays.length?money(String(weeklyTotal)):'—'}</strong>
       {missing&&<small title="Net P&L incomplete: unverified days excluded">Partial</small>}
      </div>}
    </div>;
   })}
  </div>
  <p className="helper sj-calendar-caption">
   {active.length} active exit day{active.length===1?'':'s'} · {verified} verified · {active.length-verified} unverified.
   Green: profit · Red: loss · Amber: unverified · Dark: no realized exit. Monthly and weekly figures omit unverified days.
  </p>
 </section>;
}
