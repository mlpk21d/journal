'use client';
import Link from 'next/link';
import {useState} from 'react';
import {calendarCells,type DailyPoint} from '@/lib/review/daily-performance';
import {calendarMonthLabel,shiftCalendarMonth,validCalendarMonth} from '@/lib/review/calendar-navigation';
const money=(n:string|null)=>n===null?'Unverified':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n));
export function TradingCalendar({days,initialMonth,account='all'}:{days:DailyPoint[];initialMonth:string;account?:string}){
 const [month,setMonth]=useState(initialMonth);
 const cells=calendarCells(month,days);
 const active=days.filter(d=>d.date.startsWith(month));
 const verified=active.filter(d=>d.net!==null).length;
 return <section className="trading-calendar">
  <div className="trading-calendar-toolbar">
   <div><h2>Trading Calendar</h2><p className="helper">{active.length} active exit day{active.length===1?'':'s'} · {verified} verified · {active.length-verified} unverified</p></div>
   <div className="trading-calendar-nav" role="group" aria-label="Trading calendar month navigation">
    <button type="button" onClick={()=>setMonth(m=>shiftCalendarMonth(m,-1))} aria-label="Previous month" title="Previous month">‹</button>
    <label className="trading-calendar-month-label" htmlFor="trading-calendar-month">{calendarMonthLabel(month)}</label>
    <input id="trading-calendar-month" type="month" value={month} aria-label="Choose trading calendar month" onChange={e=>{
     if(validCalendarMonth(e.target.value))setMonth(e.target.value);
    }}/>
    <button type="button" onClick={()=>setMonth(m=>shiftCalendarMonth(m,1))} aria-label="Next month" title="Next month">›</button>
   </div>
  </div>
  <div className="daily-calendar">
   <div className="daily-calendar-head">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(s=><strong key={s}>{s}</strong>)}</div>
   <div className="daily-calendar-grid">{cells.map((day,i)=>day===null?<div key={'blank-'+i} className="daily-calendar-empty"/>:
    <div key={day.date} className={'daily-calendar-day '+(!day.closures?'daily-no-activity':day.net===null?'daily-unknown':Number(day.net)>0?'daily-positive':Number(day.net)<0?'daily-negative':'daily-flat')}>
     <span>{Number(day.date.slice(-2))}</span>
     {day.closures>0&&<><strong>{money(day.net)}</strong><small>{day.closures} FIFO match{day.closures===1?'':'es'}</small>
      {account!=='all'&&<Link href={'/review/session?account='+encodeURIComponent(account)+'&date='+day.date} aria-label={'Review '+day.date+' session'}>Session ↗</Link>}</>}
    </div>)}</div>
  </div>
  <p className="helper">Green: profit · Red: loss · Amber: unverified net · Neutral: breakeven · Dim: no realized exit.</p>
 </section>;
}
