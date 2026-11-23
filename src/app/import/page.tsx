'use client';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { loadWebullAccounts, syncWebullFromBrowser, type BrokerAccount, type SyncResult } from './actions';

function localDate(offset: number): string {
 const d=new Date();d.setDate(d.getDate()+offset);
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
export default function ImportPage() {
 const [accounts,setAccounts]=useState<BrokerAccount[]>([]);
 const [account,setAccount]=useState('__all__');
 const [from,setFrom]=useState(()=>localDate(-3));
 const [through,setThrough]=useState(()=>localDate(0));
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState('');
 const [result,setResult]=useState<SyncResult|null>(null);
 const [pending,startTransition]=useTransition();
 useEffect(()=>{
  let mounted=true;
  loadWebullAccounts().then(r=>{
   if(!mounted)return;
   if(r.ok) {setAccounts(r.accounts);setAccount(r.accounts.length>1?'__all__':r.accounts[0].id);setMessage('');}
   else setMessage(r.error);
  }).catch(()=>{if(mounted)setMessage('Unable to discover Webull accounts. Check the server terminal.');})
  .finally(()=>{if(mounted)setLoading(false);});
  return ()=>{mounted=false;};
 },[]);
 function sync() {
  if(pending || loading || !accounts.length) return;
  setMessage('');setResult(null);
  startTransition(async()=>{
   try {
    const response=await syncWebullFromBrowser(account,from,through);
    setResult(response);
    if(!response.ok)setMessage(response.error);
   }catch {
    setMessage('Import request failed. Check the Next.js terminal output.');
   }
  });
 }
 return <main className="shell">
  <header><Link href="/" className="brand">TRADE / JOURNAL</Link><span className="muted">Webull · Local import</span></header>
  <section className="page-title"><p className="eyebrow">WEBULL INTEGRATION</p><h1>Import trades</h1>
   <p className="intro">Accounts are discovered directly from Webull. Import one brokerage account or all available accounts into PostgreSQL, without entering account IDs or using curl.</p>
  </section>
  <section className="import-panel">
   <div className="import-heading"><h2>Import settings</h2><span className="local-indicator">Local development</span></div>
   <label className="field-label" htmlFor="account">Brokerage account</label>
   <select id="account" value={account} disabled={loading||pending||!accounts.length} onChange={e=>setAccount(e.target.value)}>
    {loading?<option value="__all__">Detecting accounts…</option>:!accounts.length?<option value="__all__">No accounts discovered</option>:<>
     {accounts.length>1&&<option value="__all__">All accounts ({accounts.length})</option>}
     {accounts.map(a=><option value={a.id} key={a.id}>{a.type} ·•••• {a.id.slice(-4)}</option>)}
    </>}
   </select>
   <div className="date-grid">
    <div><label htmlFor="from" className="field-label">From date</label><input id="from" type="date" value={from} max={through} disabled={pending} onChange={e=>setFrom(e.target.value)}/></div>
    <div><label htmlFor="through" className="field-label">Through date</label><input id="through" type="date" value={through} max={localDate(0)} disabled={pending} onChange={e=>setThrough(e.target.value)}/></div>
   </div>
   <p className="helper">For the initial test, select 1–3 trading days. Maximum 31 calendar days per request. Re-importing the same days updates existing orders rather than creating duplicates.</p>
   <button className="primary-button" type="button" disabled={loading||pending||!accounts.length||!from||!through} onClick={sync}>
    {pending?'Import running…':'Import Webull trades'}
   </button>
   {pending&&<p role="status" className="helper">Importing accounts sequentially. Keep this page open; the Next.js terminal will show errors.</p>}
   {message&&<p role="alert" className="notice">{message}</p>}
   {result?.ok&&<div className="import-result" role="status"><h3>Import results</h3>
    {result.results.map((r,i)=><div className="account-result" key={i}>
      <div className="account-result-header"><strong>Account •••• {r.account}</strong><span>{r.ok?'Completed':'Failed'}</span></div>
      {r.ok?<p>{r.scanned} scanned · {r.savedOrders} saved/updated · {r.savedExecutions} completed snapshots · {r.skippedSnapshots} without snapshots</p>:<p>{r.error}</p>}
     </div>)}
    <p className="helper">Saved counts include updates, not only new trades. Fees remain recorded at the order level. Validate against Webull before using tax calculations.</p>
    <Link href="/trades">Review imported trades →</Link>
   </div>}
  </section>
  <footer><span>Read-only import · No trades placed</span><Link href="/trades">Trade history ↗</Link></footer>
 </main>;
}
