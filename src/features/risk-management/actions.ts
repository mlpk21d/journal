'use server';
import {headers} from 'next/headers';
import {db} from '@/lib/db';
import {activeAccountId} from '@/lib/review/account-scope';
import {reviewIsLocal} from '@/lib/review/server';
import {balanceFor} from '@/lib/risk/webull-data';
import {quoteFor,atrFor} from '@/lib/risk/fmp-data';
import {FmpQuoteError} from '@/lib/risk/fmp-quote';
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
  console.info('[Risk Management] Refresh started',{symbol});
  const [balance,quote,atr]=await Promise.all([balanceFor(account.external_account_id),quoteFor(symbol),atrFor(symbol).catch(e=>{console.warn('[Risk Management] FMP ATR unavailable',e instanceof FmpQuoteError?{code:e.code,status:e.status}:'Unknown');return null;})]);
  console.info('[Risk Management] Refresh completed',{symbol,quoteFetchedAt:quote.quoteFetchedAt,balanceFetchedAt:balance.balanceFetchedAt});
  return {ok:true as const,data:{...balance,...quote,atr,symbol,accountId:selected}};
 }catch(e){
  if(e instanceof FmpQuoteError){
   console.warn('[Risk Management] FMP quote failed',{code:e.code,status:e.status});
   const error=e.code==='MISSING_KEY'?'Set FMP_API_KEY in .env.local and restart Next.js.':e.status===429?'FMP rate limit reached. Try after the cooldown.':[401,402,403].includes(e.status??0)?'FMP quote access denied. Verify API key and subscription.':e.code==='INVALID_QUOTE'?'FMP returned no valid price for this ticker.':'FMP quote unavailable. Try again.';
   return {ok:false as const,error};
  }
  console.error('[Risk Management] Lookup failed',e instanceof WebullApiError?{status:e.status,code:e.code}:e instanceof Error?e.name:'Unknown');
  return {ok:false as const,error:e instanceof WebullApiError&&e.status===429?'Webull rate limit reached. Try after the cooldown.': 'Webull account balance unavailable. Verify trading API credentials and server logs.'};
 }
}
