'use client';
import {useState,useTransition,type FormEvent} from 'react';
import {COMMON_STRATEGIES} from '@/lib/review/strategies';
import {TradeScreenshots} from '@/components/trade-screenshots';
import {saveTradeJournal,type JournalSaveState} from '@/features/trade-journal/actions';
import type {StoredJournal} from '@/lib/review/journal-store';
const initial:JournalSaveState={ok:false,message:''};
export function TradeJournalEditor({cycleKey,fingerprint,journal,onSaved}:{cycleKey:string;fingerprint:string;journal:StoredJournal|null;onSaved?:()=>void}){
 const [state,setState]=useState<JournalSaveState>(initial);
 const [pending,startTransition]=useTransition();
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(pending)return;
  // Prevent the browser / React action form from clearing inputs when a
  // response arrives. On failure the user's draft remains editable.
  const form=new FormData(event.currentTarget);
  setState(initial);
  startTransition(async()=>{
   try{
    const result=await saveTradeJournal(initial,form);
    if(result.ok){
     if(onSaved){onSaved();return;}
     setState(result);
    }else setState(result);
   }catch(error){
    console.error('[Trade journal] Save request failed:',error);
    setState({ok:false,message:'Unable to save your notes. They are still in the form; please retry.'});
   }
  });
 }
 return <section className="journal-editor"><h2>Trade journal</h2>
  <p className="helper">Your strategy, reasoning and lessons are saved separately from Webull data. Screenshot references use HTTPS URLs.</p>
  <form onSubmit={submit}>
   <input type="hidden" name="cycleKey" value={cycleKey}/>
   <input type="hidden" name="fingerprint" value={fingerprint}/>
   <div className="journal-grid">
    <label>Strategy<input name="strategy" list="journal-common-strategies" maxLength={120} defaultValue={journal?.strategy??''} placeholder="Choose or type a strategy"/><datalist id="journal-common-strategies">{COMMON_STRATEGIES.map(s=><option key={s} value={s}/>)}</datalist></label>
    <label>Screenshot URL<input name="screenshotUrl" type="url" maxLength={1500} defaultValue={journal?.screenshotUrl??''} placeholder="https://..."/></label>
   </div>
   <label>Setup<textarea name="setup" rows={3} maxLength={2000} defaultValue={journal?.setup??''}/></label>
   <label>Entry reasoning<textarea name="entryReason" rows={4} maxLength={5000} defaultValue={journal?.entryReason??''}/></label>
   <label>Exit reasoning<textarea name="exitReason" rows={4} maxLength={5000} defaultValue={journal?.exitReason??''}/></label>
   <label>Mistakes / rule violations<textarea name="mistakes" rows={3} maxLength={2000} defaultValue={journal?.mistakes??''}/></label>
   <label>Lessons learned<textarea name="lessons" rows={4} maxLength={5000} defaultValue={journal?.lessons??''}/></label>
   <button type="submit" disabled={pending}>{pending?'Saving…':'Save journal entry'}</button>
   {state.message&&<p role="status" className="notice">{state.message}</p>}
  </form>
  {journal&&<TradeScreenshots cycleKey={cycleKey} fingerprint={fingerprint} journalId={journal.id}/>}
  {!journal&&state.ok&&<p className="helper">Journal saved. Close and reopen this trade to attach screenshots.</p>}
  {journal&&<p className="helper">Journal ID: {journal.id} · Updated: {journal.updatedAt.slice(0,19).replace('T',' ')} UTC
  {journal.screenshotUrl&&<> · <a href={journal.screenshotUrl} target="_blank" rel="noopener noreferrer">Open screenshot ↗</a></>}</p>}
 </section>;
}
