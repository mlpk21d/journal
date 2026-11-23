import 'server-only';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {headers} from 'next/headers';
import {db} from '@/lib/db';
import {loadReviewLedger} from '@/lib/review/server';
import {auditTrade} from '@/lib/review/details';
import {tradeFingerprint} from '@/lib/review/identity';
import {getJournal} from '@/lib/review/journal-store';
import {MAX_BYTES,validateScreenshot} from './screenshot-validation';
export {MAX_BYTES} from './screenshot-validation';
const dir=()=>process.env.JOURNAL_UPLOAD_DIR||join(process.cwd(),'data','trade-screenshots');
export async function requireLocalScreenshotAccess(mutate=false){
 const h=await headers(),host=h.get('host')??'';
 if(process.env.NODE_ENV!=='development'||!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host))
  throw new Error('Access restricted to local development');
 if(mutate){
  const origin=h.get('origin');if(!origin)throw new Error('Missing origin');
  let url:URL;try{url=new URL(origin);}catch{throw new Error('Invalid origin');}
  if(!['http:','https:'].includes(url.protocol)||url.host.toLowerCase()!==host.toLowerCase())
   throw new Error('Cross-origin request denied');
 }
}
export async function verifiedJournal(cycleKey:string,fingerprint:string){
 if(!cycleKey||cycleKey.length>250||!/^[0-9a-f]{64}$/.test(fingerprint))throw new Error('Invalid trade reference');
 const {entries}=await loadReviewLedger(null),audit=auditTrade(entries,cycleKey);
 if(!audit||tradeFingerprint(audit.trade,entries)!==fingerprint)throw new Error('Trade changed; refresh before editing screenshots');
 const journal=await getJournal(cycleKey);
 if(!journal||journal.fingerprint!==fingerprint)throw new Error('Save the journal entry first, then reopen this trade');
 return journal;
}
export type Screenshot={id:string;url:string;createdAt:string;byteSize:number};
export async function listScreenshots(journalId:string):Promise<Screenshot[]>{
 const r=await db().query<{id:string;created_at:Date;byte_size:number}>(
  'SELECT id::text,created_at,byte_size FROM trade_journal_screenshots WHERE journal_id=$1::uuid ORDER BY created_at,id',[journalId]);
 return r.rows.map(x=>({id:x.id,url:'/api/review/screenshots/'+x.id,createdAt:x.created_at.toISOString(),byteSize:x.byte_size}));
}
export async function saveScreenshot(journalId:string,bytes:Uint8Array,mime:string){
 const suffix=validateScreenshot(bytes,mime);
 const count=await db().query<{count:string}>('SELECT count(*)::text AS count FROM trade_journal_screenshots WHERE journal_id=$1::uuid',[journalId]);
 if(Number(count.rows[0].count)>=10)throw new Error('Maximum 10 screenshots per trade');
 const name=randomUUID()+'.'+suffix;
 await mkdir(dir(),{recursive:true,mode:0o700});
 const location=join(dir(),name);
 await writeFile(location,bytes,{flag:'wx',mode:0o600});
 try{
  await db().query('INSERT INTO trade_journal_screenshots(journal_id,storage_name,mime_type,byte_size) VALUES($1::uuid,$2,$3,$4)',[journalId,name,mime,bytes.length]);
 }catch(e){await unlink(location).catch(()=>{});throw e;}
}
export async function removeScreenshot(journalId:string,id:string){
 if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Invalid screenshot ID');
 const r=await db().query<{storage_name:string}>(
  'DELETE FROM trade_journal_screenshots WHERE journal_id=$1::uuid AND id=$2::uuid RETURNING storage_name',[journalId,id]);
 if(!r.rowCount)throw new Error('Screenshot not found');
 await unlink(join(dir(),r.rows[0].storage_name)).catch(e=>console.error('[Screenshot] Cleanup failed',e));
}
export async function screenshotFile(id:string){
 if(!/^[0-9a-f-]{36}$/i.test(id))return null;
 const r=await db().query<{mime_type:string;storage_name:string}>(
  'SELECT mime_type,storage_name FROM trade_journal_screenshots WHERE id=$1::uuid',[id]);
 const file=r.rows[0];if(!file)return null;
 if(!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(file.storage_name))throw new Error('Bad stored filename');
 return {mime:file.mime_type,bytes:await readFile(join(dir(),file.storage_name))};
}
