'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {importTodayForSelectedAccount,type TodayImportResult} from '@/app/import/actions';
import type {WorkspaceAccount} from '@/lib/review/account-scope-shared';

export function ImportTodayButton({accounts,selected}:{accounts:WorkspaceAccount[];selected:string|null}){
 const selectedAccount=accounts.find(a=>a.id===selected);
 const allowed=selectedAccount?.broker==='webull';
 const [pending,setPending]=useState(false);
 const [result,setResult]=useState<TodayImportResult|null>(null);
 const busy=useRef(false);
 const router=useRouter();
 const close=useCallback(()=>setResult(null),[]);
 useEffect(()=>{
  if(!result)return;
  const listener=(event:KeyboardEvent)=>{if(event.key==='Escape')close();};
  document.addEventListener('keydown',listener);
  return()=>document.removeEventListener('keydown',listener);
 },[result,close]);
 useEffect(()=>{
  if(!pending&&!result)return;
  const previous=document.body.style.overflow;
  document.body.style.overflow='hidden';
  return()=>{document.body.style.overflow=previous;};
 },[pending,result]);
 async function run(){
  if(!allowed||busy.current)return;
  busy.current=true;
  setPending(true);setResult(null);
  try{
   const response=await importTodayForSelectedAccount();
   setResult(response);
   if(response.ok)router.refresh();
  }catch{
   setResult({ok:false,error:'The import request failed. Check your connection and server log.'});
  }finally{
   busy.current=false;
   setPending(false);
  }
 }
 const reason=!selected?'Select one Webull account in the sidebar first.':
  !allowed?'Import Today is available only for Webull accounts, not manual accounts.':
  'Import today’s Webull trades for '+selectedAccount.label;
 return <>
  <button type="button" className="sj-topbar-import" onClick={()=>void run()}
   disabled={!allowed||pending} title={reason} aria-label="Import Today's Trades">
   <span aria-hidden="true">⇧</span><span>Import Todays Trades</span>
  </button>
  {pending&&<div className="sj-today-overlay" role="alertdialog" aria-modal="true"
   aria-label="Importing today's trades" aria-busy="true">
   <div className="sj-today-dialog sj-today-working" role="status">
    <span className="sj-today-spinner" aria-hidden="true"/>
    <h2>Importing Today’s Trades</h2>
    <p>{selectedAccount?.label}</p>
    <p className="sj-today-muted">Importing Webull orders and execution snapshots. This may include records already saved. Keep this page open.</p>
   </div>
  </div>}
  {!pending&&result&&<div className="sj-today-overlay" role="presentation"
   onMouseDown={e=>{if(e.target===e.currentTarget)close();}}>
   <div className="sj-today-dialog" role="dialog" aria-modal="true"
    aria-label={result.ok?'Today’s import complete':'Today’s import failed'}>
    {result.ok?<><span className="sj-today-status sj-today-success" aria-hidden="true">✓</span>
     <h2>Today’s Import Complete</h2>
     <p>{result.account} · {result.date} (ET)</p>
     <strong className="sj-today-number">{result.newTrades}</strong>
     <span className="sj-today-number-caption">new trades imported</span>
     <div className="sj-today-stats"><span>{result.updatedTrades} existing trades updated</span>
      <span>{result.processedTrades} total trade snapshots processed</span>
      <span>{result.scanned} orders scanned</span></div>
     <p className="sj-today-muted">Webull records are weighted-average completed-order snapshots. Re-importing previously saved records updates them without duplicating trades.</p>
    </>:<><span className="sj-today-status sj-today-error" aria-hidden="true">!</span>
     <h2>Import Not Completed</h2><p role="alert">{result.error}</p></>}
    <button type="button" className="sj-today-close" autoFocus onClick={close}>Close</button>
   </div>
  </div>}
 </>;
}
