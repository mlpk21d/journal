'use client';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {ACCOUNT_COOKIE} from '@/lib/review/account-scope-shared';
import { loadWebullAccounts, refreshWebullAccounts, syncWebullFromBrowser, type BrokerAccount, type SyncResult } from './actions';

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
 const [refreshing,setRefreshing]=useState(false);
 const [pending,startTransition]=useTransition();
 useEffect(()=>{
  let mounted=true;
  async function initialize(){
   try{
    const saved=await loadWebullAccounts();
    if(!mounted)return;
    if(saved.ok){
     setAccounts(saved.accounts);
     const active=document.cookie.split('; ').find(v=>v.startsWith(ACCOUNT_COOKIE+'='))?.slice(ACCOUNT_COOKIE.length+1);
     setAccount(active&&saved.accounts.some(a=>a.id===active)?active:
      (saved.accounts.length>1?'__all__':saved.accounts[0]?.id??'__all__'));
     setMessage('');
    }else setMessage(saved.error);
   }catch{if(mounted)setMessage('Could not load saved brokerage accounts. Check the terminal.');}
   finally{if(mounted)setLoading(false);}
   // This runs after saved accounts are visible. The database enforces
   // the 30-minute refresh cooldown, preventing repeated Webull requests.
   if(!mounted)return;
   setRefreshing(true);
   try{
    const refreshed=await refreshWebullAccounts();
    if(mounted&&refreshed.ok){
     setAccounts(refreshed.accounts);
     setAccount(current=>current==='__all__'&&refreshed.accounts.length>1?'__all__':
      refreshed.accounts.some(a=>a.id===current)?current:(refreshed.accounts.length>1?'__all__':refreshed.accounts[0]?.id??'__all__'));
    }
   }catch{console.warn('Silent account refresh failed; cached accounts remain available');}
   finally{if(mounted)setRefreshing(false);}
  }
  void initialize();
  return()=>{mounted=false;};
 },[]);

 function sync(todayOnly=false) {
  if(pending || loading || !accounts.length) return;
  setMessage('');setResult(null);
  startTransition(async()=>{
   try {
    const date=todayOnly?localDate(0):from;
    const response=await syncWebullFromBrowser(account,date,todayOnly?date:through);
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
  <p className="helper">Using Charles Schwab? <Link href="/import/schwab">Import a Schwab Transactions CSV ↗</Link> · <Link href="/fees">Manage separate brokerage fees ↗</Link></p>
  <section className="import-panel">
   <div className="import-heading"><h2>Import settings</h2><span className="local-indicator">Local development</span></div>
   <label className="field-label" htmlFor="account">Brokerage account</label>
   <select id="account" value={account} disabled={loading||pending||!accounts.length} onChange={e=>setAccount(e.target.value)}>
    {loading?<option value="__all__">Loading saved accounts…</option>:!accounts.length?<option value="__all__">No saved accounts yet</option>:<>
     {accounts.length>1&&<option value="__all__">All accounts ({accounts.length})</option>}
     {accounts.map(a=><option value={a.id} key={a.id}>{a.label}</option>)}
    </>}
   </select>
   <p className="helper">{refreshing?'Checking for account updates quietly…':'Account list loaded from local PostgreSQL cache.'}</p>
   <div className="date-grid">
    <div><label htmlFor="from" className="field-label">From date</label><input id="from" type="date" value={from} max={through} disabled={pending} onChange={e=>setFrom(e.target.value)}/></div>
    <div><label htmlFor="through" className="field-label">Through date</label><input id="through" type="date" value={through} max={localDate(0)} disabled={pending} onChange={e=>setThrough(e.target.value)}/></div>
   </div>
   <p className="helper">For the initial test, select 1–3 trading days. Maximum 31 calendar days per request. Re-importing the same days updates existing orders rather than creating duplicates.</p>
   <button className="primary-button" type="button" disabled={loading||pending||!accounts.length||!from||!through} onClick={()=>sync(false)}>
    {pending?'Import running…':'Import Webull trades'}
   </button>
   <button className="manual-secondary" type="button" disabled={loading||pending||!accounts.length} onClick={()=>sync(true)} style={{marginLeft:12}}>{pending?'Import running…':"Import Today's Trades"}</button>
   {pending&&<p role="status" className="helper">Importing accounts sequentially. Keep this page open; the Next.js terminal will show errors.</p>}
   {message&&<p role="alert" className="notice">{message}</p>}
   {result?.ok&&<div className="import-result" role="status"><h3>Import results</h3>
    {result.results.map((r,i)=><div className="account-result" key={i}>
      <div className="account-result-header"><strong>{r.account}</strong><span>{r.ok?'Completed':'Failed'}</span></div>
      {r.ok?<p>{r.scanned} scanned · {r.savedOrders} saved/updated · {r.savedExecutions} completed snapshots · {r.skippedSnapshots} without snapshots</p>:<p>{r.error}</p>}
     </div>)}
    <p className="helper">Saved counts include updates, not only new trades. Fees remain recorded at the order level. Validate against Webull before using tax calculations.</p>
    <Link href="/trades">Review imported trades →</Link>
   </div>}
  </section>
  <footer><span>Read-only import · No trades placed</span><Link href="/trades">Trade history ↗</Link></footer>
 </main>;
}
