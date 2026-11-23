'use client';
import {useRef,useState,useTransition,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {deleteManualTrade,saveManualTrade} from './actions';

export type AccountOption={id:string;label:string};
export type ManualTradeRow={id:string;accountId:string;symbol:string;date:string;time:string;side:'BUY'|'SELL';entryType:'OPENING'|'TRADE';quantity:string;price:string;fees:string;notes:string};
export type ManualTradeEditorProps={
 accounts:AccountOption[];trades:ManualTradeRow[];
 title?:string;description?:string;showHistory?:boolean;
};
export default function ManualTradeEditor({accounts,trades,title='Manual trade entry',description,showHistory=true}:ManualTradeEditorProps){
 const [editing,setEditing]=useState<ManualTradeRow|null>(null);
 const [formKey,setFormKey]=useState(0);
 const [pending,start]=useTransition();
 const [message,setMessage]=useState('');
 const [error,setError]=useState(false);
 const router=useRouter();
 const formRef=useRef<HTMLFormElement>(null);
 const editingId=editing?.id??null;
 function reset(){setEditing(null);setFormKey(x=>x+1);}
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(pending)return;
  const form=new FormData(event.currentTarget);
  if(editingId)form.set('id',editingId);
  setMessage('');
  setError(false);
  start(async()=>{
   try{
    const result=await saveManualTrade(form);
    setMessage(result.message);setError(!result.ok);
    if(result.ok){reset();router.refresh();}
    else formRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
   }catch(err){
    console.error('[Manual trades] Submit failed',err);
    setMessage('Unable to reach the save action. Check your Next.js terminal and reload this page.');
    setError(true);
   }
  });
 }
 function remove(id:string){
  if(!window.confirm('Delete this manual trade? This will change the FIFO performance report.'))return;
  start(async()=>{
   const result=await deleteManualTrade(id);
   setMessage(result.message);setError(!result.ok);
   if(result.ok){if(editingId===id)reset();router.refresh();}
  });
 }
 const defaultTime=editing?.time??'12:00';
 return <>
  <section className="import-panel">
   <h2>{editing?'Edit manual trade':title}</h2>
   {description&&<p className="helper">{description}</p>}
   <form key={editing?.id??'new-'+formKey} ref={formRef} onSubmit={submit} className="manual-lot-form">
    <label className="field-label" htmlFor="manual-account">Brokerage account</label>
    <select id="manual-account" name="account" required disabled={pending||!accounts.length} defaultValue={editing?.accountId??''}>
     <option value="" disabled>Select account</option>
     {accounts.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
    </select>
    <div className="date-grid">
     <div><label className="field-label" htmlFor="manual-type">Entry type</label>
      <select id="manual-type" name="entryType" defaultValue={editing?.entryType??'TRADE'} required>
       <option value="TRADE">Trade</option><option value="OPENING">Opening shares (historical buy)</option>
      </select></div>
     <div><label className="field-label" htmlFor="manual-side">Side</label>
      <select id="manual-side" name="side" defaultValue={editing?.side??'BUY'} required>
       <option value="BUY">BUY</option><option value="SELL">SELL</option>
      </select></div>
     <div><label className="field-label" htmlFor="manual-symbol">Ticker</label>
      <input id="manual-symbol" name="symbol" defaultValue={editing?.symbol??''} placeholder="AMZN" maxLength={30} required/></div>
     <div><label className="field-label" htmlFor="manual-date">Trade / acquisition date (UTC)</label>
      <input id="manual-date" name="date" type="date" defaultValue={editing?.date??''} required/></div>
     <div><label className="field-label" htmlFor="manual-time">Time (UTC)</label>
      <input id="manual-time" name="time" type="time" defaultValue={defaultTime} required/></div>
     <div><label className="field-label" htmlFor="manual-shares">Shares</label>
      <input id="manual-shares" name="quantity" type="number" min="0.00000001" step="0.00000001" defaultValue={editing?.quantity??''} required/></div>
     <div><label className="field-label" htmlFor="manual-price">Price per share ($)</label>
      <input id="manual-price" name="price" type="number" min="0" step="0.00000001" defaultValue={editing?.price??''} required/></div>
     <div><label className="field-label" htmlFor="manual-fees">Total fees ($)</label>
      <input id="manual-fees" name="fees" type="number" min="0" step="0.00000001" defaultValue={editing?.fees??'0'} required/></div>
    </div>
    <label className="field-label" htmlFor="manual-notes">Notes / source</label>
    <textarea id="manual-notes" name="notes" rows={3} maxLength={400} defaultValue={editing?.notes??''} placeholder="E.g. free stock award, transfer, or verified trade statement"/>
    <p className="notice">Manual entries affect provisional FIFO P&amp;L but are not Webull executions. A $0 entry price is allowed; gifted or promotional shares may have a nonzero tax basis. Verify your records. Use Opening shares only for historical BUY acquisitions.</p>
    <label className="manual-check"><input name="acknowledged" type="checkbox" value="yes" required/> I understand this is a manually supplied, unverified record.</label>
    {message&&<p className="notice" role={error?'alert':'status'}>{message}</p>}
    <div className="manual-actions">
     <button className="primary-button" type="submit" disabled={pending||!accounts.length}>{pending?'Saving…':editing?'Update trade':'Add trade'}</button>
     {editing&&<button className="manual-secondary" type="button" disabled={pending} onClick={reset}>Cancel edit</button>}
    </div>
   </form>
  </section>
  {showHistory&&<>
   <h2>Manual entries</h2>
   {trades.length===0?<p className="notice">No manual trades entered yet.</p>:
   <div className="table-scroll"><table><thead><tr><th>Date (UTC)</th><th>Account</th><th>Symbol</th><th>Type</th><th>Side</th><th>Shares</th><th>Price</th><th>Fees</th><th>Actions</th></tr></thead><tbody>
    {trades.map(t=><tr key={t.id}>
     <td>{t.date} {t.time}</td><td>{accounts.find(a=>a.id===t.accountId)?.label??'Unknown'}</td>
     <td>{t.symbol}</td><td>{t.entryType==='OPENING'?'Opening':'Trade'}</td><td>{t.side}</td>
     <td>{t.quantity}</td><td>${t.price}</td><td>${t.fees}</td>
     <td><div className="manual-actions">
      <button type="button" className="text-button" disabled={pending} onClick={()=>{setEditing(t);setMessage('');window.scrollTo({top:0,behavior:'smooth'});}}>Edit</button>
      <button type="button" className="text-button" disabled={pending} onClick={()=>remove(t.id)}>Delete</button>
     </div></td>
    </tr>)}
   </tbody></table></div>}
  </>}
 </>;
}
