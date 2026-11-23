'use client';
import {useEffect,useRef,useState} from 'react';
import {REVIEW_COLUMNS,normalizeReviewColumns,type ReviewColumnKey} from '@/lib/review/columns';
import type {ReviewedTrade} from '@/lib/review/trade-review';
import {loadTradeReviewModal,type TradeModalData} from '@/features/trade-journal/modal-actions';
import {ReviewTotals,ReviewMatchTable,ReviewExecutionTable} from '@/components/review-audit';
import {TradeJournalEditor} from '@/components/trade-journal-editor';

const STORAGE_KEY='trade-journal.review.visible-columns.v1';
const money=(value:string|null)=>value===null?'Unverified':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value));
const quantity=(value:string)=>value.replace(/(\.\d*?[1-9])0+$|\.0+$/,(match,fraction:string|undefined)=>fraction??'');
const timestamp=(value:string)=>value.replace('T',' ').slice(0,19);
function duration(ms:number){
 const minutes=Math.floor(ms/60000);
 if(minutes<60)return minutes+'m';
 const hours=Math.floor(minutes/60);
 return hours<24?hours+'h '+minutes%60+'m':Math.floor(hours/24)+'d '+hours%24+'h';
}
function TradeReviewModal({id,onClose}:{id:string;onClose:()=>void}){
 const [result,setResult]=useState<TradeModalData|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const closeRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  let active=true;
  void loadTradeReviewModal(id).then(response=>{
   if(!active)return;
   if(response.ok)setResult(response.data);
   else setError(response.message);
   setLoading(false);
  },()=>{
   if(active){setError('Unable to load trade details.');setLoading(false);}
  });
  return ()=>{active=false;};
 },[id]);
 useEffect(()=>{
  const old=document.body.style.overflow;
  document.body.style.overflow='hidden';
  closeRef.current?.focus();
  function escape(event:KeyboardEvent){
   if(event.key==='Escape'){event.preventDefault();onClose();}
   if(event.key==='Tab'){
    const panel=document.getElementById('review-trade-dialog');
    if(!panel)return;
    const focusable=[...panel.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')]
     .filter(el=>el.getClientRects().length>0);
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
  }
  document.addEventListener('keydown',escape);
  return ()=>{document.body.style.overflow=old;document.removeEventListener('keydown',escape);};
 },[onClose]);
 const audit=result?.audit;
 return <div className="review-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <section id="review-trade-dialog" className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-modal-title" aria-describedby="review-modal-description">
   <div className="review-modal-header">
    <div><p className="eyebrow">COMPLETED TRADE</p><h2 id="review-modal-title">{audit?audit.trade.symbol+' · '+audit.trade.direction:'Trade review'}</h2></div>
    <button className="review-modal-close" ref={closeRef} type="button" onClick={onClose} aria-label="Close trade review">×</button>
   </div>
   <div className="review-modal-body">
    <p id="review-modal-description" className="helper">Trade details, FIFO matches and journal notes without leaving the Review table.</p>
    {loading?<p role="status" className="notice">Loading trade details…</p>:error?<p role="alert" className="notice">{error}</p>:result&&audit&&<>
     <p className="helper">Account: {result.accountLabel} · Quantity: {quantity(audit.trade.quantity)} · Entry: {timestamp(audit.trade.enteredAt)} UTC · Exit: {timestamp(audit.trade.exitedAt)} UTC · Avg entry: {money(audit.trade.entryPrice)} · Avg exit: {money(audit.trade.exitPrice)}</p>
     <ReviewTotals gross={audit.gross} fees={audit.fees} net={audit.net}/>
     {result.journal&&result.journal.fingerprint!==result.fingerprint
      ?<p role="alert" className="notice">This trade changed since its journal entry was saved. Existing notes ({result.journal.id}) are preserved; editing is blocked pending reconciliation.</p>
      :<TradeJournalEditor key={id} cycleKey={id} fingerprint={result.fingerprint} journal={result.journal}/>}
     <h2>FIFO realized matches</h2><ReviewMatchTable matches={audit.matches}/>
     <h2>Participating executions</h2><ReviewExecutionTable executions={audit.executions}/>
     <p className="helper">Order fees are shown per execution; allocated realized fees use the existing FIFO engine. Imported transactions are not editable here.</p>
    </>}
   </div>
  </section>
 </div>;
}
export function ReviewTradesTable({trades,accountNames}:{trades:ReviewedTrade[];accountNames:Record<string,string>}){
 const [visible,setVisible]=useState<ReviewColumnKey[]>(()=>normalizeReviewColumns(null));
 const [loaded,setLoaded]=useState(false);
 const [configOpen,setConfigOpen]=useState(false);
 const [selected,setSelected]=useState<string|null>(null);
 const lastTrigger=useRef<HTMLButtonElement|null>(null);
 useEffect(()=>{
  try{
   const raw=localStorage.getItem(STORAGE_KEY);
   if(raw!==null)setVisible(normalizeReviewColumns(JSON.parse(raw)));
  }catch{/* Browser storage is optional; default to all columns. */}
  setLoaded(true);
 },[]);
 useEffect(()=>{
  if(!loaded)return;
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(visible));}catch{/* Private browsing may block storage. */}
 },[loaded,visible]);
 const shown=new Set(visible);
 const closeModal=()=>{
  setSelected(null);
  requestAnimationFrame(()=>lastTrigger.current?.focus());
 };
 function cell(trade:ReviewedTrade,key:ReviewColumnKey){
  switch(key){
   case 'ticker':return <button type="button" className="review-ticker-button" onClick={event=>{
    lastTrigger.current=event.currentTarget;setSelected(trade.id);
   }} aria-label={'Review '+trade.symbol+' '+trade.direction+' trade'}>{trade.symbol}</button>;
   case 'account':return accountNames[trade.accountId]??'Unknown account';
   case 'direction':return <span className={trade.direction==='LONG'?'trade-side-buy':'trade-side-sell'}>{trade.direction}</span>;
   case 'quantity':return quantity(trade.quantity);
   case 'entryPrice':return money(trade.entryPrice);
   case 'exitPrice':return money(trade.exitPrice);
   case 'enteredAt':return timestamp(trade.enteredAt);
   case 'exitedAt':return timestamp(trade.exitedAt);
   case 'duration':return duration(trade.durationMs);
   case 'gross':return money(trade.gross);
   case 'fees':return money(trade.fees);
   case 'net':return <span className={trade.net!==null&&Number(trade.net)<0?'trade-side-sell':'trade-side-buy'}>{money(trade.net)}</span>;
  }
 }
 return <section className="review-table-section">
  <div className="review-column-toolbar">
   <span className="helper">{visible.length} of {REVIEW_COLUMNS.length} columns visible</span>
   <button type="button" className="review-config-button" aria-expanded={configOpen} aria-controls="review-column-options" onClick={()=>setConfigOpen(v=>!v)}>⚙ Columns</button>
  </div>
  {configOpen&&<fieldset id="review-column-options" className="review-column-options">
   <legend>Trade Review columns</legend>
   <div className="review-column-options-grid">
    {REVIEW_COLUMNS.map(column=><label key={column.key}>
     <input type="checkbox" checked={shown.has(column.key)} disabled={column.required} onChange={e=>{
      setVisible(previous=>normalizeReviewColumns(e.target.checked?[...previous,column.key]:previous.filter(x=>x!==column.key)));
     }}/>
     {column.label}{column.required&&<span className="muted"> (always visible)</span>}
    </label>)}
   </div>
   <button type="button" className="review-reset-button" onClick={()=>setVisible(normalizeReviewColumns(null))}>Show all columns</button>
  </fieldset>}
  <div className="table-scroll review-trade-scroll">
   <table className="review-trade-table"><thead><tr>{REVIEW_COLUMNS.filter(c=>shown.has(c.key)).map(column=><th scope="col" key={column.key}>{column.label}</th>)}</tr></thead>
    <tbody>{trades.map(trade=><tr key={trade.id}>{REVIEW_COLUMNS.filter(c=>shown.has(c.key)).map(column=><td key={column.key}>{cell(trade,column.key)}</td>)}</tr>)}</tbody>
   </table>
  </div>
  {selected&&<TradeReviewModal id={selected} onClose={closeModal}/>}
 </section>;
}
