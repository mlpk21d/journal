'use client';
import {useActionState} from 'react';
import {saveTradeJournal,type JournalSaveState} from '@/features/trade-journal/actions';
import type {StoredJournal} from '@/lib/review/journal-store';
const initial:JournalSaveState={ok:false,message:''};
export function TradeJournalEditor({cycleKey,fingerprint,journal}:{cycleKey:string;fingerprint:string;journal:StoredJournal|null}){
 const [state,action,pending]=useActionState(saveTradeJournal,initial);
 return <section className="journal-editor"><h2>Trade journal</h2>
  <p className="helper">Your strategy, reasoning and lessons are saved separately from Webull data. Screenshot references use HTTPS URLs.</p>
  <form action={action}>
   <input type="hidden" name="cycleKey" value={cycleKey}/>
   <input type="hidden" name="fingerprint" value={fingerprint}/>
   <div className="journal-grid">
    <label>Strategy<input name="strategy" maxLength={120} defaultValue={journal?.strategy??''} placeholder="Opening range breakout"/></label>
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
  {journal&&<p className="helper">Journal ID: {journal.id} · Updated: {journal.updatedAt.slice(0,19).replace('T',' ')} UTC
  {journal.screenshotUrl&&<> · <a href={journal.screenshotUrl} target="_blank" rel="noopener noreferrer">Open screenshot ↗</a></>}</p>}
 </section>;
}
