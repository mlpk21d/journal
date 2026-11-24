import {activeAccountId} from '@/lib/review/account-scope';
import Link from 'next/link';
import {reviewIsLocal,loadReviewLedger} from '@/lib/review/server';
import {buildTradeReview} from '@/lib/review/trade-review';
import {summarizeDailySessions} from '@/lib/review/daily-performance';
import {TradingCalendar} from '@/components/trading-calendar';
export const dynamic='force-dynamic';
type Filters={account?:string};
export default async function CalendarPage({searchParams}:{searchParams:Promise<Filters>}){
 if(!await reviewIsLocal())return <main className="shell"><p className="notice">Trading Calendar is restricted to the local workspace.</p></main>;
 const filters=await searchParams;
 const account=(await activeAccountId())??'all';
 const valid=account==='all'||/^\d{1,19}$/.test(account);
 let days:ReturnType<typeof summarizeDailySessions>['days']=[];
 let accounts:{id:string;label:string}[]=[];
 let error='';
 if(valid)try{
  const source=await loadReviewLedger(account==='all'?null:account);
  accounts=source.accounts.map(a=>({id:a.id,label:source.accountLabel(a.id)}));
  const result=buildTradeReview(source.entries);
  days=summarizeDailySessions(result.sessions).days;
 }catch(e){
  console.error('[Calendar] Failed:',e);
  error=e instanceof Error&&e.message==='LIMIT_EXCEEDED'?'More than 20,000 executions; calendar stopped rather than truncate FIFO history.':
   'Unable to load trading calendar. Check the database and server logs.';
 }
 const month=days.at(-1)?.date.slice(0,7)??(()=>{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit'}).formatToParts(new Date());
  return parts.find(p=>p.type==='year')?.value+'-'+parts.find(p=>p.type==='month')?.value;
 })();
 return <main className="shell sj-calendar-page">
  <div className="sj-page-head sj-calendar-page-head"><div><p className="sj-kicker">REALIZED EXIT ACTIVITY</p><h1>Calendar</h1></div>
   <form action="/calendar" method="get" className="sj-calendar-filter">
    <span className="helper">Account scope: {account==='all'?'All Accounts':accounts.find(a=>a.id===account)?.label??'Selected account'}</span>
    <button type="submit">Apply</button>
   </form></div>
  {!valid?<p className="notice">Invalid account filter.</p>:error?<p className="notice" role="alert">{error}</p>:
   <TradingCalendar key={account} days={days} initialMonth={month} account={account} expanded/>}
  <div className="sj-calendar-page-links"><Link href="/daily">Detailed daily performance ↗</Link><Link href="/review?view=sessions">Trading sessions ↗</Link></div>
  <p className="helper">Realized FIFO net P&amp;L, including partial closes of still-open positions. Unknown net values are not treated as zero; monthly and weekly known-net amounts are provisional and are not account equity or tax reporting.</p>
 </main>;
}
