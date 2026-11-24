'use server';
import {headers} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
export type FeeResult={ok:boolean;message:string};
async function local(){
 const h=await headers(),host=h.get('host')??'',origin=h.get('origin');
 if(process.env.NODE_ENV!=='development'||!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host))
  throw new Error('Fees are restricted to the local development workspace.');
 if(origin){
  let url:URL;try{url=new URL(origin);}catch{throw new Error('Invalid origin.');}
  if(!['http:','https:'].includes(url.protocol)||url.host.toLowerCase()!==host.toLowerCase())
   throw new Error('Cross-origin request denied.');
 }
}
function error(e:unknown):FeeResult{
 const err=e as {code?:string;message?:string};
 console.error('[Fees] Failed:',{code:err.code,message:err.message});
 if(err.code==='42P01')return {ok:false,message:'Run npm run db:migrate to create the fees table.'};
 if(err.message&&(/^(Select|Enter|Invalid|Fee |Date |Description )/.test(err.message)))
  return {ok:false,message:err.message};
 return {ok:false,message:'Unable to save the fee. See the server terminal.'};
}
function refresh(){for(const p of ['/fees','/settings'])revalidatePath(p);}
export async function saveAccountFee(form:FormData):Promise<FeeResult>{
 try{
  await local();
  const account=String(form.get('account')??'');
  const date=String(form.get('date')??'');
  const type=String(form.get('type')??'').trim();
  const description=String(form.get('description')??'').trim();
  const amount=String(form.get('amount')??'');
  if(!/^\d{1,19}$/.test(account))throw new Error('Select a brokerage account.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)
   throw new Error('Invalid fee date.');
  if(type.length<1||type.length>100)throw new Error('Fee type must be 1–100 characters.');
  if(description.length>500)throw new Error('Description must be at most 500 characters.');
  if(!/^\d+(?:\.\d{1,8})?$/.test(amount)||Number(amount)<=0||Number(amount)>1e12)
   throw new Error('Enter a positive fee amount.');
  const existing=await db().query('SELECT id FROM brokerage_accounts WHERE id=$1::bigint',[account]);
  if(!existing.rowCount)throw new Error('Select a valid brokerage account.');
  await db().query(
   "INSERT INTO account_fees(brokerage_account_id,fee_date,fee_type,description,amount,source) VALUES($1,$2,$3,$4,$5::numeric,'manual')",
   [account,date,type,description,amount]);
  refresh();return {ok:true,message:'Account fee saved.'};
 }catch(e){return error(e);}
}
export async function deleteAccountFee(id:string):Promise<FeeResult>{
 try{
  await local();
  if(!/^\d{1,19}$/.test(id))throw new Error('Invalid fee ID.');
  const r=await db().query("DELETE FROM account_fees WHERE id=$1::bigint AND source='manual' RETURNING id",[id]);
  if(!r.rowCount)throw new Error('Fee not found or imported from CSV. CSV fees cannot be deleted here.');
  refresh();return {ok:true,message:'Fee deleted.'};
 }catch(e){return error(e);}
}
