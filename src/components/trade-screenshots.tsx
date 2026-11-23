'use client';
import {useEffect,useState,type ChangeEvent} from 'react';
import type {Screenshot} from '@/lib/review/screenshots';
export function TradeScreenshots({cycleKey,fingerprint,journalId}:{cycleKey:string;fingerprint:string;journalId:string}){
 const [items,setItems]=useState<Screenshot[]>([]);
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const params=new URLSearchParams({cycleKey,fingerprint});
 useEffect(()=>{
  let live=true;
  void fetch('/api/review/screenshots?'+params.toString(),{cache:'no-store'})
   .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error);return data as {screenshots:Screenshot[]};})
   .then(data=>{if(live)setItems(data.screenshots);})
   .catch(e=>{if(live)setMessage(e.message??'Unable to load screenshots');});
  return ()=>{live=false;};
 // Only reload when the selected journal changes.
 },[cycleKey,fingerprint,journalId]);
 async function upload(){
  if(!file)return;
  setBusy(true);setMessage('');
  try{
   const form=new FormData();
   form.set('cycleKey',cycleKey);form.set('fingerprint',fingerprint);form.set('file',file);
   const response=await fetch('/api/review/screenshots',{method:'POST',body:form});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error);
   setItems(data.screenshots);setFile(null);setMessage('Screenshot saved.');
  }catch(e){setMessage(e instanceof Error?e.message:'Upload failed');}
  finally{setBusy(false);}
 }
 async function remove(id:string){
  setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/review/screenshots',{method:'DELETE',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({cycleKey,fingerprint,id})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error);
   setItems(data.screenshots);setMessage('Screenshot deleted.');
  }catch(e){setMessage(e instanceof Error?e.message:'Delete failed');}
  finally{setBusy(false);}
 }
 return <div className="journal-screenshots"><h3>Chart screenshots</h3>
  <p className="helper">Upload up to 10 PNG, JPEG or WebP screenshots, maximum 5 MB each. Stored locally and accessible only through the development server.</p>
  <div className="screenshot-controls">
   <input aria-label="Choose chart screenshot" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e:ChangeEvent<HTMLInputElement>)=>setFile(e.target.files?.[0]??null)}/>
   <button type="button" disabled={busy||!file} onClick={upload}>{busy?'Working…':'Upload screenshot'}</button>
  </div>
  {message&&<p className="helper" role="status">{message}</p>}
  {!!items.length&&<div className="screenshot-grid">{items.map(item=><div key={item.id} className="screenshot-card">
   <a href={item.url} target="_blank" rel="noopener noreferrer"><img src={item.url} alt={'Trade chart screenshot from '+item.createdAt.slice(0,10)}/></a>
   <div><small>{item.createdAt.slice(0,10)} · {Math.ceil(item.byteSize/1024)} KB</small>
    <button type="button" onClick={()=>remove(item.id)} disabled={busy} aria-label="Delete screenshot">Delete</button>
   </div>
  </div>)}</div>}
 </div>;
}
