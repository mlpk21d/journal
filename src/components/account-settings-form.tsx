'use client';
import {useState,useTransition,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {createManualAccount} from '@/features/manual-trades/actions';
export function AccountSettingsForm(){
 const [name,setName]=useState('');
 const [broker,setBroker]=useState<'schwab'|'manual'>('schwab');
 const [message,setMessage]=useState('');
 const [ok,setOk]=useState(false);
 const [pending,start]=useTransition();
 const router=useRouter();
 function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(pending)return;
  const form=new FormData();form.set('name',name);form.set('broker',broker);
  start(async()=>{
   try{
    const result=await createManualAccount(form);
    setMessage(result.message);setOk(result.ok);
    if(result.ok){setName('');router.refresh();}
   }catch{setMessage('Could not create brokerage account. Check the server log.');setOk(false);}
  });
 }
 return <form onSubmit={submit} className="sj-settings-form">
  <label htmlFor="sj-account-broker">Brokerage type</label>
  <select id="sj-account-broker" value={broker} onChange={e=>setBroker(e.target.value as 'manual'|'schwab')}>
   <option value="schwab">Charles Schwab (CSV import)</option><option value="manual">Other / Manual</option>
  </select>
  <label htmlFor="sj-new-account-name">Account name</label>
  <div className="sj-settings-input-row"><input id="sj-new-account-name" value={name} onChange={e=>setName(e.target.value)}
   maxLength={100} required minLength={2} placeholder="e.g. Charles Schwab – Individual"/>
   <button type="submit" disabled={pending||name.trim().length<2}>{pending?'Creating…':'Create Account'}</button></div>
  {message&&<p role={ok?'status':'alert'} className="helper">{message}</p>}
 </form>;
}
