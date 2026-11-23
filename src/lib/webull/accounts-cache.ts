import { db } from '@/lib/db';
import { webull } from './client';
import { object, stringField } from './normalize';

export type CachedAccount={id:string;label:string;type:string;masked:string};
const idPattern=/^[a-zA-Z0-9_-]{6,80}$/;
const clean=(s:string|null)=>s?.trim().slice(0,100)||null;
function safeMask(s:string|null):string|null{
 if(!s)return null;
 return s.includes('*')||s.includes('•')?clean(s):'•••• '+s.slice(-4);
}
export async function cachedAccounts():Promise<CachedAccount[]>{
 const {rows}=await db().query<{
  id:string;external_account_id:string;account_type:string|null;display_name:string|null;
  user_label:string|null;masked_account:string|null
 }>(`SELECT id::text,external_account_id,account_type,display_name,user_label,masked_account
 FROM brokerage_accounts WHERE broker='webull' ORDER BY id`);
 return rows.map(a=>({
  id:a.external_account_id,type:a.account_type??'Brokerage',
  label:a.user_label || [a.display_name,a.masked_account].filter(Boolean).join(' · ') ||
    [a.account_type??'Brokerage','ID •••• '+a.external_account_id.slice(-4)].join(' · '),
  masked:a.masked_account??'ID •••• '+a.external_account_id.slice(-4)
 }));
}
export async function refreshAccountCache():Promise<{updated:boolean;reason:string}>{
 const pool=db();
 // Atomic database claim avoids duplicate Webull calls across page loads.
 const claim=await pool.query(`UPDATE brokerage_cache_control
 SET next_refresh_at=now()+interval '30 minutes'
 WHERE broker='webull' AND next_refresh_at<=now() RETURNING broker`);
 if(!claim.rowCount)return {updated:false,reason:'Cache is fresh'};
 try{
  const raw=await webull.accounts();
  const container=object(raw);
  const values=Array.isArray(raw)?raw:container?.data;
  if(!Array.isArray(values)||!values.length)throw new Error('Unexpected empty Webull account response');
  const accounts=values.map(object).filter((x):x is Record<string,unknown>=>!!x);
  const valid=accounts.filter(a=>idPattern.test(stringField(a,'account_id')??''));
  if(!valid.length)throw new Error('No valid account IDs returned');
  const conn=await pool.connect();
  try{
   await conn.query('BEGIN');
   for(const a of valid){
    const id=stringField(a,'account_id')!;
    const type=clean(stringField(a,'account_type','type'));
    const name=clean(stringField(a,'account_name','account_display_name','display_name','name'));
    const mask=safeMask(stringField(a,'account_number','account_no','account_num','masked_account','account_mask'));
    await conn.query(`INSERT INTO brokerage_accounts
      (broker,external_account_id,account_type,display_name,masked_account,metadata_updated_at)
      VALUES ('webull',$1,$2,$3,$4,now())
      ON CONFLICT (broker,external_account_id) DO UPDATE SET
       account_type=COALESCE(EXCLUDED.account_type,brokerage_accounts.account_type),
       display_name=COALESCE(EXCLUDED.display_name,brokerage_accounts.display_name),
       masked_account=COALESCE(EXCLUDED.masked_account,brokerage_accounts.masked_account),
       metadata_updated_at=now()`,[id,type,name,mask]);
   }
   await conn.query("UPDATE brokerage_cache_control SET last_success_at=now(),last_error=NULL WHERE broker='webull'");
   await conn.query('COMMIT');
  }catch(e){await conn.query('ROLLBACK');throw e;}finally{conn.release();}
  return {updated:true,reason:'Account cache refreshed'};
 }catch(e){
  console.error('[Webull] Account cache refresh failed',e);
  await pool.query(`UPDATE brokerage_cache_control SET next_refresh_at=now()+interval '5 minutes',
    last_error='Refresh failed' WHERE broker='webull'`);
  return {updated:false,reason:'Refresh failed; saved accounts retained'};
 }
}
export async function setAccountLabel(id:string,label:string):Promise<void>{
 if(!idPattern.test(id)||label.length>100||!/^[\p{L}\p{N} ._()*-]*$/u.test(label))throw new Error('Invalid label');
 const r=await db().query("UPDATE brokerage_accounts SET user_label=$1 WHERE broker='webull' AND external_account_id=$2",
 [label.trim()||null,id]);
 if(!r.rowCount)throw new Error('Unknown account');
}
