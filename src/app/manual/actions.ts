'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

export type ManualResult={ok:boolean;message:string};
async function localOnly():Promise<void>{
 const h=await headers();const host=h.get('host')??'';
 const origin=h.get('origin');
 if(process.env.NODE_ENV!=='development'||!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host))
  throw new Error('Manual entries are only available on the local development server');
 if(origin){
  let url:URL;
  try{url=new URL(origin);}catch{throw new Error('Invalid origin');}
  if(url.host.toLowerCase()!==host.toLowerCase()||!['http:','https:'].includes(url.protocol))throw new Error('Cross-origin request refused');
 }
}
const decimal=/^\d+(?:\.\d{1,8})?$/;
export async function addManualOpeningLot(form:FormData):Promise<ManualResult>{
 try {
  await localOnly();
  const account=String(form.get('account')??'');
  const symbol=String(form.get('symbol')??'').trim().toUpperCase();
  const date=String(form.get('date')??'');
  const quantity=String(form.get('quantity')??'').trim();
  const unitBasis=String(form.get('basis')??'').trim();
  const notes=String(form.get('notes')??'').trim();
  const acknowledged=form.get('acknowledged')==='yes';
  if(!/^\d{1,19}$/.test(account)|| !/^[A-Z0-9.^_-]{1,30}$/.test(symbol)||
     !/^\d{4}-\d{2}-\d{2}$/.test(date)||!decimal.test(quantity)||!decimal.test(unitBasis)||
     notes.length>400||!acknowledged)return {ok:false,message:'Check the required fields and acknowledge the basis warning.'};
  const acquired=new Date(date+'T12:00:00.000Z');
  if(Number.isNaN(acquired.valueOf())||acquired.toISOString().slice(0,10)!==date||acquired.getTime()>Date.now())return {ok:false,message:'Enter a valid historical acquisition date.'};
  if(Number(quantity)<=0||Number(unitBasis)<0||!Number.isFinite(Number(quantity))||!Number.isFinite(Number(unitBasis)))
   return {ok:false,message:'Share count must exceed zero; cost basis cannot be negative.'};
  const pool=db();
  const acct=await pool.query("SELECT id FROM brokerage_accounts WHERE id=$1 AND broker='webull'",[account]);
  if(!acct.rowCount)return {ok:false,message:'Select a valid Webull brokerage account.'};
  await pool.query(`INSERT INTO manual_opening_lots (brokerage_account_id,symbol,acquired_at,quantity,unit_basis,notes)
     VALUES ($1,$2,$3,$4::numeric,$5::numeric,$6)`,[account,symbol,acquired.toISOString(),quantity,unitBasis,notes]);
  revalidatePath('/manual');revalidatePath('/performance');revalidatePath('/trades');
  return {ok:true,message:'Historical opening lot saved. Recheck provisional performance.'};
 }catch(error){
  console.error('[Manual lots] Add failed',error);
  return {ok:false,message:'Could not save opening lot. Check the Next.js terminal and migration 004.'};
 }
}
export async function deleteManualOpeningLot(id:string):Promise<ManualResult>{
 try{
  await localOnly();
  if(!/^\d{1,19}$/.test(id))return {ok:false,message:'Invalid lot identifier.'};
  const result=await db().query('DELETE FROM manual_opening_lots WHERE id=$1 RETURNING id',[id]);
  if(!result.rowCount)return {ok:false,message:'Lot not found.'};
  revalidatePath('/manual');revalidatePath('/performance');revalidatePath('/trades');
  return {ok:true,message:'Manual opening lot deleted.'};
 }catch(error){
  console.error('[Manual lots] Delete failed',error);
  return {ok:false,message:'Could not delete lot. Check the server terminal.'};
 }
}
