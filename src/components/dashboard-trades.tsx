import Link from 'next/link';
import type {ReviewedTrade} from '@/lib/review/trade-review';
const money=(value:string|null)=>value===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value));
const qty=(value:string)=>value.replace(/(\.\d*?[1-9])0+$|\.0+$/,(match,fraction:string|undefined)=>fraction??'');
const fmtDate=(date:string)=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(date));
function hold(ms:number){
 const minutes=Math.floor(ms/60000);
 if(minutes<60)return minutes+'m';
 const h=Math.floor(minutes/60);
 return h<24?h+'h '+minutes%60+'m':Math.floor(h/24)+'d '+h%24+'h';
}
export function DashboardTrades({trades}:{trades:ReviewedTrade[]}){
 const visible=[...trades].sort((a,b)=>b.exitedAt.localeCompare(a.exitedAt)||b.id.localeCompare(a.id)).slice(0,30);
 return <section className="sj-trades-panel">
  <div className="sj-section-heading sj-dashboard-table-heading"><div><h2>Completed Trade History</h2><p>Latest {visible.length} completed FIFO trade cycles</p></div><Link href="/review">View all trades ↗</Link></div>
  {!visible.length?<div className="sj-empty-trades"><div className="sj-empty-icon">▥</div><p>No completed trades yet. Import or enter trades to populate your journal.</p><Link href="/manual">Add Trade</Link></div>:
   <div className="table-scroll"><table className="sj-dashboard-table">
    <thead><tr><th>Date (ET)</th><th>Symbol</th><th>Status</th><th>Direction</th><th>Qty</th><th>Entry</th><th>Exit</th><th>Entry Total</th><th>Exit Total</th><th>Hold</th><th>Net Return</th><th>Return %</th></tr></thead>
    <tbody>{visible.map(t=>{
     const entryValue=Number(t.entryPrice)*Number(t.quantity);
     const exitValue=Number(t.exitPrice)*Number(t.quantity);
     const percent=t.net!==null&&entryValue>0?Number(t.net)/entryValue*100:null;
     return <tr key={t.id}>
      <td>{fmtDate(t.exitedAt)}</td><td><Link className="sj-symbol-link" href={'/review/trade?id='+encodeURIComponent(t.id)}>{t.symbol}</Link></td>
      <td><span className="sj-status-closed">Closed</span></td>
      <td><span className={t.direction==='LONG'?'trade-side-buy':'trade-side-sell'}>{t.direction}</span></td>
      <td>{qty(t.quantity)}</td><td>{money(t.entryPrice)}</td><td>{money(t.exitPrice)}</td>
      <td>{money(String(entryValue))}</td><td>{money(String(exitValue))}</td><td>{hold(t.durationMs)}</td>
      <td className={t.net===null?'':Number(t.net)<0?'trade-side-sell':'trade-side-buy'}>{t.net===null?'Unverified':money(t.net)}</td>
      <td className={percent===null?'':percent<0?'trade-side-sell':'trade-side-buy'}>{percent===null?'—':percent.toFixed(2)+'%'}</td>
     </tr>;
    })}</tbody>
   </table></div>}
 </section>;
}
