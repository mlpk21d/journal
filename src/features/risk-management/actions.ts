'use server';
import {headers} from 'next/headers';
import {db} from '@/lib/db';
import {activeAccountId} from '@/lib/review/account-scope';
import {reviewIsLocal} from '@/lib/review/server';
import {balanceFor,quoteFor} from '@/lib/risk/webull-data';
import {WebullApiError} from '@/lib/webull/client';
export async function loadRiskInputs(symbol:string,category:'US_STOCK'|'US_ETF',expectedAccount:string){
 try{
  if(!await reviewIsLocal())return {ok:false as const,error:'Local development only.'};
  const h=await headers(),origin=h.get('origin');
  if(origin&&new URL(origin).host!==h.get('host'))return {ok:false as const,error:'Invalid origin.'};
  if(typeof symbol!=='string'||!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)||!['US_STOCK','US_ETF'].includes(category))return {ok:false as const,error:'Enter a valid US stock or ETF ticker.'};
  const selected=await activeAccountId();
  if(!selected||selected!==expectedAccount)return {ok:false as const,error:'Select one Webull account in the sidebar.'};
  const {rows}=await db().query<{external_account_id:string;broker:string}>('SELECT external_account_id,broker FROM brokerage_accounts WHERE id=$1::bigint',[selected]);
  const account=rows[0];
  if(!account||account.broker!=='webull')return {ok:false as const,error:'Select a Webull brokerage account.'};
  const [balance,quote]=await Promise.all([balanceFor(account.external_account_id),quoteFor(symbol,category)]);
  return {ok:true as const,data:{...balance,...quote,symbol,accountId:selected}};
 }catch(e){
  console.error('[Risk Management] Lookup failed',e instanceof WebullApiError?{status:e.status,code:e.code}:e instanceof Error?e.name:'Unknown');
  return {ok:false as const,error:e instanceof WebullApiError&&e.status===429?'Webull rate limit reached. Try after the cooldown.': 'Quote or balance unavailable. Verify ticker, Webull market-data permissions and server logs.'};
 }
}
