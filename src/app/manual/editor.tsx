'use client';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {addManualOpeningLot,deleteManualOpeningLot} from './actions';
export type AccountOption={id:string;label:string};
export type LotRow={id:string;accountId:string;symbol:string;date:string;quantity:string;basis:string;notes:string};
export default function ManualLotsEditor({accounts,lots}:{accounts:AccountOption[];lots:LotRow[]}){
 const [pending,start]=useTransition();
 const [message,setMessage]=useState('');
 const [failed,setFailed]=useState(false);
 const router=useRouter();
 function submit(form:FormData){
  setMessage('');
  start(async()=>{
   const result=await addManualOpeningLot(form);
   setMessage(result.message);setFailed(!result.ok);
   if(result.ok)router.refresh();
  });
 }
 function remove(id:string){
  if(!window.confirm('Delete this manually entered historical lot? This will change the FIFO calculation.'))return;
  start(async()=>{
   const result=await deleteManualOpeningLot(id);
   setMessage(result.message);setFailed(!result.ok);
   if(result.ok)router.refresh();
  });
 }
 return <>
  <section className="import-panel">
   <h2>Add historical shares</h2>
   <p className="helper">Use this for shares acquired before your Webull import window, including promotional or gifted shares. This does not submit a trade to Webull.</p>
   <form action={submit} className="manual-lot-form">
    <label className="field-label" htmlFor="manual-account">Brokerage account</label>
    <select id="manual-account" name="account" required disabled={pending||!accounts.length} defaultValue="">
     <option value="" disabled>Select account</option>
     {accounts.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
    </select>
    <div className="date-grid">
     <div><label className="field-label" htmlFor="manual-symbol">Ticker</label><input id="manual-symbol" name="symbol" placeholder="AMZN" maxLength={30} required/></div>
     <div><label className="field-label" htmlFor="manual-date">Original acquisition date</label><input id="manual-date" name="date" type="date" max={new Date().toISOString().slice(0,10)} required/></div>
     <div><label className="field-label" htmlFor="manual-shares">Shares received</label><input id="manual-shares" name="quantity" type="number" min="0.00000001" step="0.00000001" placeholder="100" required/></div>
     <div><label className="field-label" htmlFor="manual-basis">Cost basis per share ($)</label><input id="manual-basis" name="basis" type="number" min="0" step="0.00000001" placeholder="0.00" required/></div>
    </div>
    <label className="field-label" htmlFor="manual-notes">Source / notes (optional)</label>
    <textarea id="manual-notes" name="notes" rows={3} maxLength={400} placeholder="e.g., account-opening stock award; original statement date"></textarea>
    <div className="notice"><strong>Cost basis warning:</strong> $0 is allowed, but free or gifted shares do not necessarily have a $0 tax basis. Enter the basis supported by your Webull statement or award documentation. These entries remain marked unverified and are for provisional performance only.</div>
    <label className="manual-check"><input name="acknowledged" type="checkbox" value="yes" required/> I understand this is a user-supplied, unverified opening lot.</label>
    <button className="primary-button" type="submit" disabled={pending||!accounts.length}>{pending?'Saving…':'Save opening lot'}</button>
   </form>
   {message&&<p className="notice" role={failed?'alert':'status'}>{message}</p>}
  </section>
  <h2>Manual opening lots</h2>
  {lots.length===0?<p className="notice">No manually entered opening lots yet.</p>:<div className="table-scroll"><table><thead><tr><th>Acquired</th><th>Account</th><th>Symbol</th><th>Shares</th><th>Unit basis</th><th>Source</th><th>Action</th></tr></thead><tbody>
   {lots.map(l=><tr key={l.id}><td>{l.date}</td><td>{accounts.find(a=>a.id===l.accountId)?.label??'Unknown'}</td><td>{l.symbol}</td><td>{l.quantity}</td><td>${l.basis}</td><td>{l.notes||'Unverified'}</td><td><button className="text-button" type="button" disabled={pending} onClick={()=>remove(l.id)}>Delete</button></td></tr>)}
  </tbody></table></div>}
 </>;
}
