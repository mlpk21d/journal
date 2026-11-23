import 'server-only';
import {db} from '@/lib/db';
import type {JournalDraft} from './identity';
export type StoredJournal=JournalDraft & {id:string;cycleKey:string;fingerprint:string;updatedAt:string};
export async function getJournal(cycleKey:string):Promise<StoredJournal|null>{
 const r=await db().query<{
  id:string;cycle_key:string;fingerprint:string;strategy:string;setup:string;
  entry_reason:string;exit_reason:string;mistakes:string;lessons:string;screenshot_url:string;updated_at:Date
 }>('SELECT id::text,cycle_key,fingerprint,strategy,setup,entry_reason,exit_reason,mistakes,lessons,screenshot_url,updated_at FROM trade_journal_entries WHERE cycle_key=$1',[cycleKey]);
 const x=r.rows[0];return x?{
  id:x.id,cycleKey:x.cycle_key,fingerprint:x.fingerprint,updatedAt:x.updated_at.toISOString(),
  strategy:x.strategy,setup:x.setup,entryReason:x.entry_reason,exitReason:x.exit_reason,
  mistakes:x.mistakes,lessons:x.lessons,screenshotUrl:x.screenshot_url
 }:null;
}
