'use client';
import {useEffect,useRef} from 'react';
import ManualTradeEditor,{type AccountOption} from '@/features/manual-trades/editor';

export function NewTradeModal({accounts,selected,onClose}:{accounts:AccountOption[];selected:string|null;onClose:()=>void}){
 const dialog=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const prior=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const target=dialog.current?.querySelector<HTMLElement>('select,input,button');
  target?.focus();
  function keys(event:KeyboardEvent){
   if(event.key==='Escape'){event.preventDefault();onClose();}
   if(event.key==='Tab'){
    const root=dialog.current;
    if(!root)return;
    const options=[...root.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])')]
      .filter(el=>el.getClientRects().length>0);
    if(!options.length)return;
    const first=options[0],last=options[options.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
  }
  document.addEventListener('keydown',keys);
  return()=>{document.body.style.overflow=prior;document.removeEventListener('keydown',keys);};
 },[onClose]);
 return <div className="sj-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div ref={dialog} role="dialog" aria-modal="true" aria-label="Add manual trade" className="sj-new-trade-modal">
   <div className="sj-modal-head"><div><p className="sj-kicker">TRADE MANAGEMENT</p><h2>New Trade</h2></div>
    <button type="button" onClick={onClose} aria-label="Close new trade form">×</button></div>
   <div className="sj-modal-content">
    {!accounts.length?<p className="notice">No brokerage accounts available. <a href="/settings">Create an account in Settings</a> first.</p>:
     <ManualTradeEditor accounts={accounts} trades={[]} showHistory={false} selectedAccountId={selected} onSaved={onClose}
      title="Manual trade" description="Enter a BUY or SELL from an existing brokerage account. Dates and times are UTC."/>}
   </div>
  </div>
 </div>;
}
