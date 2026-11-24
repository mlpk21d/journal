'use server';
import {headers} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {db} from '@/lib/db';
import {parseSchwabCsv,type SchwabPreview} from '@/lib/schwab/csv';

export type SchwabImportSummary={ok:true;trades:number;newTrades:number;alreadyImported:number;fees:number;newFees:number;alreadyImportedFees:number;ignored:number;wireSent:number;warnings:string[]};
export type SchwabImportResponse=SchwabImportSummary|{ok:false;error:string};
export type SchwabPreviewResponse={ok:true;preview:SchwabPreview}|{ok:false;error:string};
async function assertLocal(){
 const h=await headers(),host=h.get('host')??'',origin=h.get('origin');
 if(process.env.NODE_ENV!=='development'||!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host))
  throw new Error('CSV import is available only in the local development workspace');
 if(origin){
  let url:URL;try{url=new URL(origin);}catch{throw new Error('Invalid origin');}
  if(!['http:','https:'].includes(url.protocol)||url.host.toLowerCase()!==host.toLowerCase())
   throw new Error('Cross-origin request refused');
 }
}
async function readCsv(form:FormData){
 const file=form.get('csv');
 if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.csv'))
  throw new Error('Select a Charles Schwab .csv transactions file.');
 if(file.size===0||file.size>2_000_000)throw new Error('Select a nonempty CSV smaller than 2 MB.');
 return parseSchwabCsv(await file.text());
}
function message(e:unknown):string{
 const error=e as {message?:string;code?:string};
 if(error.code==='42P01'||error.code==='42703')return 'Run npm run db:migrate before importing Schwab data.';
 if(error.message&&(/^(CSV|Invalid|Expected|Empty|Select|More than|Unable to|Schwab)/.test(error.message)))
  return error.message;
 return 'Schwab import failed. Review the application terminal; no partial file changes were saved.';
}
function refresh(){
 for(const path of ['/','/settings','/import','/fees','/trades','/manual','/review','/performance',
  '/ticker-pnl','/stats','/calendar','/daily','/analytics','/risk','/timing','/insights','/wash-sales','/wash-sales/basis'])
  revalidatePath(path);
}
export async function previewSchwabFile(form:FormData):Promise<SchwabPreviewResponse>{
 try{await assertLocal();return {ok:true,preview:await readCsv(form)};}
 catch(e){return {ok:false,error:message(e)};}
}
/** All rows imported transactionally, scoped to selected Schwab/manual account. */
export async function importSchwabFile(form:FormData):Promise<SchwabImportResponse>{
 try{
  await assertLocal();
  const accountId=String(form.get('account')??'');
  if(!/^\d{1,19}$/.test(accountId))throw new Error('Select one Schwab or manual brokerage account.');
  if(form.get('confirm')!=='yes')throw new Error('Select the confirmation checkbox to import the previewed rows.');
  const preview=await readCsv(form);
  if(preview.rows.length===0)throw new Error('CSV contains no supported trade or service-fee records.');
  const conn=await db().connect();
  let newTrades=0,newFees=0;
  try{
   await conn.query('BEGIN');
   const acct=await conn.query<{id:string;broker:string}>(
    "SELECT id::text,broker FROM brokerage_accounts WHERE id=$1::bigint AND broker IN ('schwab','manual') FOR UPDATE",[accountId]);
   if(!acct.rows[0])throw new Error('Select a valid Schwab or manual account, not a Webull account.');
   for(const row of preview.rows){
    if(row.kind==='fee'){
     const result=await conn.query(
      "INSERT INTO account_fees(brokerage_account_id,fee_date,fee_type,description,amount,source,source_key) VALUES($1,$2,$3,$4,$5::numeric,'schwab_csv',$6) ON CONFLICT (brokerage_account_id,source,source_key) DO NOTHING RETURNING id",
      [accountId,row.date,row.feeType,row.description,row.amount,row.key]);
     if(result.rowCount)newFees++;
     continue;
    }
    const orderId='schwab-csv:'+row.key;
    const payload={csv_action:row.action,description:row.description,csv_line:row.line,
     synthetic_execution_time:true,source:'schwab_csv'};
    const order=await conn.query<{id:string}>(
     "INSERT INTO brokerage_orders(brokerage_account_id,broker_order_id,symbol,side,status,ordered_at,raw_payload) VALUES($1,$2,$3,$4,'FILLED',$5,$6::jsonb) ON CONFLICT (brokerage_account_id,broker_order_id) DO UPDATE SET last_seen_at=now() RETURNING id",
     [accountId,orderId,row.symbol,row.side,row.timestamp,JSON.stringify(payload)]);
    const orderPk=order.rows[0].id;
    const inserted=await conn.query(
     "INSERT INTO executions(brokerage_account_id,brokerage_order_id,source,broker_execution_id,symbol,side,quantity,price,executed_at,raw_payload) VALUES($1,$2,'schwab_csv',$3,$4,$5,$6::numeric,$7::numeric,$8,$9::jsonb) ON CONFLICT (brokerage_account_id,broker_execution_id) DO NOTHING RETURNING id",
     [accountId,orderPk,row.key,row.symbol,row.side,row.quantity,row.price,row.timestamp,JSON.stringify(payload)]);
    if(inserted.rowCount)newTrades++;
    if(Number(row.fees)>0){
     await conn.query(
      "INSERT INTO brokerage_order_fees(brokerage_order_id,fee_type,amount) VALUES($1,'SCHWAB_COMMISSION',$2::numeric) ON CONFLICT (brokerage_order_id,fee_type) DO NOTHING",
      [orderPk,row.fees]);
    }
   }
   await conn.query('COMMIT');
  }catch(e){await conn.query('ROLLBACK');throw e;}finally{conn.release();}
  refresh();
  return {ok:true,trades:preview.trades,newTrades,alreadyImported:preview.trades-newTrades,
   fees:preview.fees,newFees,alreadyImportedFees:preview.fees-newFees,ignored:preview.ignored,
   wireSent:preview.wireSent,warnings:preview.warnings};
 }catch(e){
  console.error('[Schwab CSV] Import failed:',e);
  return {ok:false,error:message(e)};
 }
}
