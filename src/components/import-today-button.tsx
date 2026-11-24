'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import type {WorkspaceAccount} from '@/lib/review/account-scope-shared';

type Progress=
 | {stage:'starting';account:string;date:string}
 | {stage:'scanning';pages:number;found:number}
 | {stage:'ready';total:number;previouslyImported:number}
 | {stage:'trade';processed:number;total:number;newTrades:number;updatedTrades:number;skipped:number;
    status:'new'|'updated'|'skipped';previouslyImported:boolean;brokerOrderId:string|null;symbol:string|null;side:string|null;
    quantity:string|null;price:string|null;executedAt:string|null}
 | {stage:'complete';summary:{scanned:number;savedExecutions:number;newExecutions:number;skippedSnapshots:number}}
 | {stage:'error';message:string};
type TodayImportResult=
 | {ok:true;account:string;date:string;newTrades:number;updatedTrades:number;processedTrades:number;scanned:number;skipped:number;previouslyImported:number}
 | {ok:false;error:string};
type ProgressState={stage:'starting'|'scanning'|'importing';scanned:number;pages:number;total:number|null;
 processed:number;previouslyImported:number|null;newTrades:number;updatedTrades:number;skipped:number};
const empty:ProgressState={stage:'starting',scanned:0,pages:0,total:null,processed:0,previouslyImported:null,newTrades:0,updatedTrades:0,skipped:0};
const progressPercent=(processed:number,total:number)=>total===0?100:Math.min(100,Math.max(0,Math.round(processed/total*100)));

/** Parses newline-delimited JSON as it arrives, rather than buffering the full import. */
async function consumeProgress(response:Response,onEvent:(event:Progress)=>void){
 if(!response.ok){
  const data=await response.json().catch(()=>null) as {error?:string}|null;
  throw new Error(data?.error??'Import request rejected.');
 }
 if(!response.body)throw new Error('Import progress stream is not available.');
 const reader=response.body.getReader();
 const decoder=new TextDecoder();
 let buffer='',completed=false;
 const parse=(line:string)=>{
  if(!line.trim())return;
  const event=JSON.parse(line) as Progress;
  onEvent(event);
  if(event.stage==='complete')completed=true;
  if(event.stage==='error')throw new Error(event.message);
 };
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   buffer+=decoder.decode(value,{stream:true});
   let nl=buffer.indexOf('\n');
   while(nl>=0){
    const line=buffer.slice(0,nl);
    buffer=buffer.slice(nl+1);
    parse(line);
    nl=buffer.indexOf('\n');
   }
  }
  buffer+=decoder.decode();
  if(buffer.trim())parse(buffer);
  if(!completed)throw new Error('Import connection ended before Webull confirmed completion. Check import history before retrying.');
 }finally{reader.releaseLock();}
}
export function ImportTodayButton({accounts,selected}:{accounts:WorkspaceAccount[];selected:string|null}){
 const selectedAccount=accounts.find(a=>a.id===selected);
 const allowed=selectedAccount?.broker==='webull';
 const [pending,setPending]=useState(false);
 const [progress,setProgress]=useState<ProgressState>(empty);
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
  if(!allowed||!selectedAccount||busy.current)return;
  busy.current=true;
  setPending(true);setResult(null);setProgress(empty);
  let accountName=selectedAccount.label,date='',previouslyImported=0;
  try{
   const response=await fetch('/api/webull/import-today',{method:'POST',credentials:'same-origin',cache:'no-store'});
   await consumeProgress(response,event=>{
    if(event.stage==='starting'){
     accountName=event.account;date=event.date;
     console.info('[Trade Journal] Daily import started',{account:accountName,date});
    }else if(event.stage==='scanning'){
     setProgress(p=>({...p,stage:'scanning',pages:event.pages,scanned:event.found}));
     console.info('[Trade Journal] Scanning Webull orders',{pages:event.pages,found:event.found});
    }else if(event.stage==='ready'){
     previouslyImported=event.previouslyImported;
     setProgress(p=>({...p,stage:'importing',total:event.total,processed:0,previouslyImported}));
     console.info('[Trade Journal] Pre-import inventory',{
      totalOrders:event.total,previouslyImportedSnapshots:event.previouslyImported,
      notPreviouslyImported:event.total-event.previouslyImported
     });
    }else if(event.stage==='trade'){
     setProgress(p=>({...p,stage:'importing',total:event.total,processed:event.processed,
      newTrades:event.newTrades,updatedTrades:event.updatedTrades,skipped:event.skipped}));
     // Logs one result per Webull order, including already-imported records.
     console.info('[Trade Journal] Imported order',{
      result:event.status,alreadyImported:event.previouslyImported,
      ticker:event.symbol,side:event.side,quantity:event.quantity,price:event.price,
      filledTime:event.executedAt,brokerOrderId:event.brokerOrderId,
      progress:event.processed+'/'+event.total
     });
    }else if(event.stage==='complete'){
     const summary=event.summary;
     const outcome:TodayImportResult={ok:true,account:accountName,date,
      newTrades:summary.newExecutions,updatedTrades:summary.savedExecutions-summary.newExecutions,
      processedTrades:summary.savedExecutions,scanned:summary.scanned,
      skipped:summary.skippedSnapshots,previouslyImported};
     setResult(outcome);
     console.info('[Trade Journal] Daily import complete',outcome);
     router.refresh();
    }
   });
  }catch(error){
   const message=error instanceof Error?error.message:'The import request failed. Check the Next.js terminal.';
   console.error('[Trade Journal] Daily import failed:',message);
   setResult({ok:false,error:message});
  }finally{
   busy.current=false;setPending(false);
  }
 }
 const reason=!selected?'Select one Webull account in the sidebar first.':
  !allowed?'Import Today is available only for Webull accounts, not manual accounts.':
  'Import today’s Webull trades for '+selectedAccount.label;
 const percentage=progress.total===null?null:progressPercent(progress.processed,progress.total);
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
    <p className="sj-today-muted">{progress.stage==='starting'
     ?'Preparing Webull account import…':
     progress.stage==='scanning'
      ?'Scanning order history… '+progress.scanned+' orders found across '+progress.pages+' page(s).':
      'Processing '+progress.processed+' of '+progress.total+' Webull orders.'}</p>
    <div className="sj-import-progress-track" role="progressbar"
     aria-label="Trade import progress" aria-valuemin={0} aria-valuemax={100}
     aria-valuenow={percentage??undefined} aria-valuetext={percentage===null?'Scanning orders':percentage+' percent'}>
     <span className={percentage===null?'sj-import-progress-indeterminate':''}
      style={percentage===null?undefined:{width:percentage+'%'}}/>
    </div>
    <strong className="sj-import-progress-percent">{percentage===null?'Scanning…':percentage+'%'}</strong>
    {progress.total!==null&&<div className="sj-today-stats">
     <span>{progress.previouslyImported} trades already imported before this run</span>
     <span>{progress.newTrades} new · {progress.updatedTrades} previously imported / updated</span>
     <span>{progress.skipped} skipped · {progress.processed} / {progress.total} orders processed</span>
    </div>}
    <p className="sj-today-muted">Open Developer Tools → Console to view each order and whether it was new, previously imported, or skipped. Keep this page open.</p>
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
     <div className="sj-today-stats">
      <span>{result.previouslyImported} trades already imported before this run</span>
      <span>{result.updatedTrades} existing trades updated</span>
      <span>{result.processedTrades} completed snapshots processed</span>
      <span>{result.skipped} skipped · {result.scanned} orders scanned</span>
     </div>
     <p className="sj-today-muted">Counts are order-level snapshots. Re-importing previously saved records updates them rather than duplicating trades.</p>
    </>:<><span className="sj-today-status sj-today-error" aria-hidden="true">!</span>
     <h2>Import Not Completed</h2><p role="alert">{result.error}</p></>}
    <button type="button" className="sj-today-close" autoFocus onClick={close}>Close</button>
   </div>
  </div>}
 </>;
}
