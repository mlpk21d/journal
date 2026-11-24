import {NextRequest} from 'next/server';
import {db} from '@/lib/db';
import {cachedAccounts} from '@/lib/webull/accounts-cache';
import {importWebullOrders,type ImportProgress} from '@/lib/webull/import';
import {WebullRateLimitError} from '@/lib/webull/client';
import {todayEasternRange} from '@/lib/webull/today-range';
import {ACCOUNT_COOKIE} from '@/lib/review/account-scope-shared';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
function localRequest(request:NextRequest):boolean{
 const host=request.headers.get('host')??'';
 if(process.env.NODE_ENV!=='development'||!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host))return false;
 const origin=request.headers.get('origin');
 if(!origin)return false;
 try{
  const url=new URL(origin);
  return ['http:','https:'].includes(url.protocol)&&url.host.toLowerCase()===host.toLowerCase();
 }catch{return false;}
}
const jsonError=(error:string,status:number)=>Response.json({error},{status});
/** NDJSON streaming response: every item is a committed order result.
 * Account is resolved from server-readable workspace cookie, not client input.
 * Every import remains read-only against the brokerage, localhost-only, and
 * protected by the existing per-account PostgreSQL advisory lock.
 */
export async function POST(request:NextRequest){
 if(!localRequest(request))return jsonError('Local same-origin development requests only.',403);
 const selected=request.cookies.get(ACCOUNT_COOKIE)?.value;
 if(!selected||!/^\d{1,19}$/.test(selected))
  return jsonError('Select a Webull account in the sidebar before importing.',400);
 let account:{external_account_id:string;broker:string}|undefined;
 try{
  const result=await db().query<{external_account_id:string;broker:string}>(
   'SELECT external_account_id,broker FROM brokerage_accounts WHERE id=$1::bigint',[selected]);
  account=result.rows[0];
 }catch(error){console.error('[Import progress] Account lookup failed:',error);return jsonError('Unable to load selected account.',500);}
 if(!account||account.broker!=='webull')
  return jsonError('Import Today requires a Webull account. Manual accounts are not supported.',400);
 const cached=await cachedAccounts().catch(()=>[]);
 const found=cached.find(a=>a.id===account.external_account_id);
 if(!found)return jsonError('Selected account was not found in the Webull account cache.',400);
 const {date,start,end}=todayEasternRange();
 const encoder=new TextEncoder();
 const stream=new ReadableStream<Uint8Array>({
  start(controller){
   let active=true;
   const send=(event:ImportProgress|{stage:'starting';account:string;date:string}|{stage:'error';message:string})=>{
    if(!active)return;
    try{controller.enqueue(encoder.encode(JSON.stringify(event)+'\n'));}
    catch{active=false;}
   };
   void (async()=>{
    try{
     send({stage:'starting',account:found.label,date});
     await importWebullOrders(found.id,start,end,send);
    }catch(error){
     console.error('[Import progress] Daily import failed:',error);
     send({stage:'error',message:error instanceof WebullRateLimitError
      ?'Webull rate limit reached; import stopped. Try again after the cooldown.'
      :error instanceof Error&&error.message.includes('already running')
       ?'An import is already running for this brokerage account.'
       :'Import interrupted. Some orders may have been committed; retry later to update rather than duplicate them.'});
    }finally{
     if(active){try{controller.close();}catch{/* Browser may have disconnected. */}}
     active=false;
    }
   })();
  }
 });
 return new Response(stream,{headers:{
  'Content-Type':'application/x-ndjson; charset=utf-8',
  'Cache-Control':'no-cache, no-transform',
  'X-Content-Type-Options':'nosniff'
 }});
}
