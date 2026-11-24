'use client';
import {useState,useTransition,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {importSchwabFile,previewSchwabFile,type SchwabImportSummary} from '@/features/schwab-import/actions';
import type {SchwabPreview} from '@/lib/schwab/csv';

export function SchwabCsvForm({accounts}:{accounts:{id:string;label:string}[]}){
 const [account,setAccount]=useState(accounts[0]?.id??'');
 const [file,setFile]=useState<File|null>(null);
 const [preview,setPreview]=useState<SchwabPreview|null>(null);
 const [confirmation,setConfirmation]=useState(false);
 const [summary,setSummary]=useState<SchwabImportSummary|null>(null);
 const [error,setError]=useState('');
 const [pending,start]=useTransition();
 const router=useRouter();
 function changeFile(next:File|null){setFile(next);setPreview(null);setSummary(null);setConfirmation(false);setError('');}
 function data(){
  const form=new FormData();
  if(file)form.set('csv',file);
  form.set('account',account);
  if(confirmation)form.set('confirm','yes');
  return form;
 }
 function examine(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(pending||!file||!account)return;
  setError('');setSummary(null);
  start(async()=>{
   try{
    const result=await previewSchwabFile(data());
    if(result.ok)setPreview(result.preview);
    else setError(result.error);
   }catch{setError('Unable to preview CSV. Check the application terminal.');}
  });
 }
 function commit(){
  if(pending||!preview||!confirmation||!file||!account)return;
  setError('');
  start(async()=>{
   try{
    const result=await importSchwabFile(data());
    if(result.ok){setSummary(result);setPreview(null);router.refresh();}
    else setError(result.error);
   }catch{setError('Unable to import CSV. Check the application terminal.');}
  });
 }
 return <section className="import-panel sj-schwab-import">
  <h2>Schwab transactions CSV</h2>
  <p className="helper">Choose the account that should own these trades. Imports never go into All Accounts or into a Webull-connected account.</p>
  {!accounts.length?<p className="notice">Create a Schwab account in <a href="/settings">Settings</a> first.</p>:
   <form onSubmit={examine}>
    <label className="field-label" htmlFor="schwab-account">Import into account</label>
    <select id="schwab-account" value={account} onChange={e=>{setAccount(e.target.value);setPreview(null);setConfirmation(false);setSummary(null);}} disabled={pending} required>
     {accounts.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
    </select>
    <label className="field-label" htmlFor="schwab-file">Schwab Transactions CSV</label>
    <input id="schwab-file" type="file" accept=".csv,text/csv" disabled={pending} required onChange={e=>changeFile(e.target.files?.[0]??null)}/>
    <button className="primary-button" type="submit" disabled={pending||!file||!account}>{pending?'Processing…':'Preview CSV'}</button>
   </form>}
  {error&&<p className="notice" role="alert">{error}</p>}
  {preview&&<div className="sj-schwab-preview">
   <h3>Import preview</h3>
   <p><strong>{preview.trades}</strong> trades · <strong>{preview.fees}</strong> standalone service fees · {preview.wireSent} Wire Sent excluded · {preview.ignored} other cash activity excluded</p>
   <p className="notice">{preview.warnings.join(' ')}</p>
   <div className="table-scroll"><table><thead><tr><th>Date (ET)</th><th>Action</th><th>Symbol / description</th><th>Shares</th><th>Price / fee</th></tr></thead>
    <tbody>{preview.rows.slice(0,25).map(row=><tr key={row.key}>
     <td>{row.date}</td><td>{row.kind==='trade'?row.action:'Service Fee'}</td>
     <td>{row.kind==='trade'?row.symbol:row.description}</td>
     <td>{row.kind==='trade'?row.quantity:'—'}</td>
     <td>{row.kind==='trade'?'$'+row.price:'$'+row.amount}</td>
    </tr>)}</tbody></table></div>
   {preview.rows.length>25&&<p className="helper">Showing the first 25 preview records. All {preview.rows.length} supported rows will import.</p>}
   <label className="manual-check"><input type="checkbox" checked={confirmation} onChange={e=>setConfirmation(e.target.checked)}/>
    I understand that the morning timestamps are estimated and that the selected brokerage account is correct.</label>
   <button type="button" className="primary-button" disabled={!confirmation||pending} onClick={commit}>{pending?'Importing…':'Import into selected account'}</button>
  </div>}
  {summary&&<div className="import-result" role="status">
   <h3>Schwab import complete</h3>
   <p><strong>{summary.newTrades}</strong> new trades · {summary.alreadyImported} already imported</p>
   <p><strong>{summary.newFees}</strong> new service fees · {summary.alreadyImportedFees} previously imported</p>
   <p>{summary.wireSent} Wire Sent rows and {summary.ignored} other unsupported cash movements excluded.</p>
   <p className="helper">{summary.warnings.join(' ')}</p>
   <a href="/trades">View trade history ↗</a> · <a href="/fees">View fees ↗</a>
  </div>}
 </section>;
}
