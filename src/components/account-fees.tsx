'use client';
import {useState,useTransition,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {deleteAccountFee,saveAccountFee} from '@/features/fees/actions';
export type FeeRow={id:string;accountId:string;accountName:string;date:string;type:string;description:string;amount:string;source:string};
const usd=(v:string)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v));
export function AccountFees({accounts,rows,selected}:{accounts:{id:string;label:string}[];rows:FeeRow[];selected:string|null}){
 const [account,setAccount]=useState(selected??accounts[0]?.id??'');
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [pending,start]=useTransition();
 const router=useRouter();
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(pending)return;
  const form=new FormData(event.currentTarget);
  form.set('account',account);
  const target=event.currentTarget;
  start(async()=>{
   try{
    const r=await saveAccountFee(form);
    if(r.ok){setError('');setMessage(r.message);target.reset();router.refresh();}
    else {setMessage('');setError(r.message);}
   }catch{setError('Unable to save the fee.');}
  });
 }
 function remove(id:string){
  if(pending||!window.confirm('Delete this manually entered fee?'))return;
  start(async()=>{
   const r=await deleteAccountFee(id);
   if(r.ok){setError('');setMessage(r.message);router.refresh();}
   else setError(r.message);
  });
 }
 const total=rows.reduce((sum,r)=>sum+Number(r.amount),0);
 return <>
  <section className="import-panel">
   <h2>Add Account Fee</h2>
   <p className="helper">Use this for separate brokerage or service charges, such as an $8 Webull fee, a $15 Schwab wire fee, or a $50 account fee. Do not enter commissions already attached to a trade.</p>
   <form onSubmit={submit}>
    <label className="field-label" htmlFor="fee-account">Brokerage account</label>
    <select id="fee-account" value={account} onChange={e=>setAccount(e.target.value)} disabled={pending} required>
     {accounts.map(a=><option value={a.id} key={a.id}>{a.label}</option>)}
    </select>
    <div className="date-grid">
     <div><label className="field-label" htmlFor="fee-date">Fee date</label><input id="fee-date" type="date" name="date" required defaultValue={new Date().toISOString().slice(0,10)}/></div>
     <div><label className="field-label" htmlFor="fee-amount">Amount ($)</label><input id="fee-amount" type="number" name="amount" min="0.01" step="0.01" required placeholder="15.00"/></div>
    </div>
    <label className="field-label" htmlFor="fee-type">Fee type</label>
    <input id="fee-type" name="type" required maxLength={100} placeholder="e.g. Wire fee, account service fee"/>
    <label className="field-label" htmlFor="fee-description">Description (optional)</label>
    <input id="fee-description" name="description" maxLength={500} placeholder="e.g. Schwab wire transfer fee"/>
    <button type="submit" className="primary-button" disabled={pending||!accounts.length}>{pending?'Saving…':'Add Fee'}</button>
   </form>
   {message&&<p role="status" className="helper">{message}</p>}
   {error&&<p role="alert" className="notice">{error}</p>}
  </section>
  <section className="sj-fee-history">
   <div className="sj-section-heading"><div><h2>Account Fee History</h2>
    <p>{rows.length} fee(s) · {selected?'Filtered to the selected sidebar account':'All accounts'}</p></div>
    <strong>{usd(String(total))} total</strong></div>
   {!rows.length?<p className="notice">No standalone fees recorded for this account yet.</p>:
    <div className="table-scroll"><table><thead><tr><th>Date</th><th>Account</th><th>Type</th><th>Description</th><th>Amount</th><th>Source</th><th>Action</th></tr></thead><tbody>
     {rows.map(r=><tr key={r.id}>
      <td>{r.date}</td><td>{r.accountName}</td><td>{r.type}</td><td>{r.description||'—'}</td>
      <td>{usd(r.amount)}</td><td>{r.source==='schwab_csv'?'Schwab CSV':'Manual'}</td>
      <td>{r.source==='manual'?<button className="text-button" disabled={pending} onClick={()=>remove(r.id)}>Delete</button>:'—'}</td>
     </tr>)}
    </tbody></table></div>}
  </section>
 </>;
}
