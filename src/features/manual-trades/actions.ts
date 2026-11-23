'use server';
import {headers} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';

export type ManualTradeResult={ok:boolean;message:string};
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
function validate(form:FormData){
 const account=String(form.get('account')??'');
 const symbol=String(form.get('symbol')??'').trim().toUpperCase();
 const date=String(form.get('date')??'');
 const time=String(form.get('time')??'12:00');
 const side=String(form.get('side')??'');
 const entryType=String(form.get('entryType')??'');
 const quantity=String(form.get('quantity')??'').trim();
 const price=String(form.get('price')??'').trim();
 const fees=String(form.get('fees')??'').trim();
 const notes=String(form.get('notes')??'').trim();
 if(!/^\d{1,19}$/.test(account)||!/^[A-Z0-9.^_-]{1,30}$/.test(symbol)||
  !/^\d{4}-\d{2}-\d{2}$/.test(date)|| !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||
  !['BUY','SELL'].includes(side)||!['OPENING','TRADE'].includes(entryType)||
  (entryType==='OPENING'&&side!=='BUY')||
  !/^\d+(?:\.\d{1,8})?$/.test(quantity)||!/^\d+(?:\.\d{1,8})?$/.test(price)||
  !/^\d+(?:\.\d{1,8})?$/.test(fees)||notes.length>400)
  throw new Error('Check account, symbol, date/time, side, quantity, price, fees and notes.');
 const timestamp=new Date(date+'T'+time+':00.000Z');
 if(!Number.isFinite(timestamp.getTime())||timestamp.toISOString().slice(0,16)!==date+'T'+time||
   timestamp.getTime()>Date.now())throw new Error('Enter a valid UTC date and time that is not in the future.');
 if(Number(quantity)<=0||!Number.isFinite(Number(quantity))||
    !Number.isFinite(Number(price))||!Number.isFinite(Number(fees))||
    Number(quantity)>1e12||Number(price)>1e12||Number(fees)>1e12)
    throw new Error('Enter a positive share quantity and valid nonnegative price and fees.');
 if(form.get('acknowledged')!=='yes')throw new Error('Acknowledge the unverified trade warning.');
 return {account,symbol,timestamp:timestamp.toISOString(),side,entryType,quantity,price,fees,notes};
}
function refresh(){for(const path of ['/manual','/performance','/trades'])revalidatePath(path);}
export async function saveManualTrade(form:FormData):Promise<ManualTradeResult>{
 try{
  await assertLocal();
  const payload=validate(form);
  const id=String(form.get('id')??'');
  if(id&&!/^\d{1,19}$/.test(id))return {ok:false,message:'Invalid manual trade ID.'};
  const conn=await db().connect();
  try{
   await conn.query('BEGIN');
   const account=await conn.query(`SELECT id FROM brokerage_accounts WHERE id=$1 AND broker='webull'`,[payload.account]);
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
  console.error('[Manual trades] Save failed:',error);
  return {ok:false,message:error instanceof Error&&(
    error.message.startsWith('Check account')||error.message.startsWith('Enter a')||
    error.message.startsWith('Acknowledge')||error.message.startsWith('Select a')||
    error.message==='Manual trade not found.')?error.message:
   'Unable to save manual trade. Check migrations and server logs.'};
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
  console.error('[Manual trades] Delete failed:',error);
  return {ok:false,message:'Unable to delete manual trade. Check server logs.'};
 }
}
