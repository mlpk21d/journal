'use server';
import {headers} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {randomUUID} from 'node:crypto';
import {validateManualTrade} from './validation';

export type ManualTradeResult={ok:boolean;message:string;code?:string};
function publicError(error:unknown):ManualTradeResult {
 const e=error as {code?:string;message?:string;constraint?:string};
 if(e?.code==='42P01'||e?.code==='42703')
  return {ok:false,code:'MIGRATION_REQUIRED',message:'Manual trade database is not updated. Run npm run db:migrate (migration 005), then restart Next.js.'};
 if(e?.code==='23503')return {ok:false,code:'UNKNOWN_ACCOUNT',message:'This brokerage account is no longer available. Refresh the page and select an account.'};
 if(e?.code==='23514'||e?.code==='22003'||e?.code==='22P02')
  return {ok:false,code:'INVALID_VALUE',message:'One of the trade values exceeds database limits or violates a constraint. Check shares, price and fees.'};
 if(e?.code==='23505')return {ok:false,code:'DUPLICATE',message:'This record conflicts with an existing database entry.'};
 if(e?.message&&(/^(Brokerage account|Ticker|Date|Time|Side|Entry type|Shares|Price|Fees|Notes|Date\/time|Confirmation):/.test(e.message)||
    e.message.startsWith('Select a')||e.message==='Manual trade not found.'))
  return {ok:false,code:'VALIDATION',message:e.message};
 return {ok:false,code:'SERVER_ERROR',message:'Manual trade could not be saved. Check the Next.js terminal for the PostgreSQL error code.'};
}
async function assertLocal():Promise<void>{
 const h=await headers(),host=h.get('host')??'',origin=h.get('origin');
 if(process.env.NODE_ENV!=='development'||!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host))
  throw new Error('Manual trades are restricted to the local development server');
 if(origin){
  let url:URL;try{url=new URL(origin);}catch{throw new Error('Invalid origin');}
  if(!['http:','https:'].includes(url.protocol)||url.host.toLowerCase()!==host.toLowerCase())
   throw new Error('Cross-origin request refused');
 }
}
function refresh(){for(const path of ['/','/manual','/settings','/stats','/calendar','/performance','/trades','/review','/analytics','/daily','/risk','/timing','/insights'])revalidatePath(path);}
export async function saveManualTrade(form:FormData):Promise<ManualTradeResult>{
 try{
  await assertLocal();
  const payload=validateManualTrade(form);
  const id=String(form.get('id')??'');
  if(id&&!/^\d{1,19}$/.test(id))return {ok:false,message:'Invalid manual trade ID.'};
  const conn=await db().connect();
  try{
   await conn.query('BEGIN');
   const account=await conn.query(`SELECT id FROM brokerage_accounts WHERE id=$1 AND broker IN ('webull','manual')`,[payload.account]);
   if(!account.rowCount)throw new Error('Select a valid brokerage account.');
   if(id){
    const update=await conn.query(`UPDATE manual_trades SET
     brokerage_account_id=$2,symbol=$3,executed_at=$4,side=$5,entry_type=$6,
     quantity=$7::numeric,price=$8::numeric,fees=$9::numeric,notes=$10,updated_at=now()
     WHERE id=$1 RETURNING id`,
     [id,payload.account,payload.symbol,payload.timestamp,payload.side,payload.entryType,payload.quantity,payload.price,payload.fees,payload.notes]);
    if(!update.rowCount)throw new Error('Manual trade not found.');
   }else{
    await conn.query(`INSERT INTO manual_trades
     (brokerage_account_id,symbol,executed_at,side,entry_type,quantity,price,fees,notes)
     VALUES($1,$2,$3,$4,$5,$6::numeric,$7::numeric,$8::numeric,$9)`,
     [payload.account,payload.symbol,payload.timestamp,payload.side,payload.entryType,payload.quantity,payload.price,payload.fees,payload.notes]);
   }
   await conn.query('COMMIT');
  }catch(err){await conn.query('ROLLBACK');throw err;}finally{conn.release();}
  refresh();
  return {ok:true,message:id?'Manual trade updated.':'Manual trade saved.'};
 }catch(error){
  const e=error as {code?:string;constraint?:string;message?:string};
  console.error('[Manual trades] Save failed:',{code:e?.code, constraint:e?.constraint,message:e?.message});
  return publicError(error);
 }
}
export async function deleteManualTrade(id:string):Promise<ManualTradeResult>{
 try{
  await assertLocal();
  if(!/^\d{1,19}$/.test(id))return {ok:false,message:'Invalid trade ID.'};
  const result=await db().query('DELETE FROM manual_trades WHERE id=$1 RETURNING id',[id]);
  if(!result.rowCount)return {ok:false,message:'Manual trade not found.'};
  refresh();return {ok:true,message:'Manual trade deleted.'};
 }catch(error){
  const e=error as {code?:string;message?:string};
  console.error('[Manual trades] Delete failed:',{code:e?.code,message:e?.message});
  return publicError(error);
 }
}

export async function createManualAccount(form:FormData):Promise<ManualTradeResult>{
 try{
  await assertLocal();
  const name=String(form.get('name')??'').trim();
  if(name.length<2||name.length>100||/[\x00-\x1f]/.test(name))
   return {ok:false,message:'Account name must be 2–100 printable characters.'};
  await db().query(
   "INSERT INTO brokerage_accounts(broker,external_account_id,account_type,user_label,display_name) VALUES('manual',$1,'Manual',$2,$2)",
   ['manual:'+randomUUID(),name]);
  refresh();return {ok:true,message:'Manual brokerage account created. Select it in the trade form.'};
 }catch(error){
  console.error('[Manual account] Creation failed',error);
  return publicError(error);
 }
}
