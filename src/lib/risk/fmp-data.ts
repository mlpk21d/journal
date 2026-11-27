import 'server-only';
import {FmpQuoteError,parseFmpQuote} from './fmp-quote';
import {calculateIntradayAtr,easternClock,BAR_MS} from './intraday-atr';
type Quote=ReturnType<typeof parseFmpQuote>;
const cache=new Map<string,{until:number;promise:Promise<Quote>}>();
let blockedUntil=0;
export async function quoteFor(symbol:string):Promise<Quote>{
 const key=process.env.FMP_API_KEY?.trim();
 if(!key)throw new FmpQuoteError('MISSING_KEY');
 const now=Date.now(),hit=cache.get(symbol);
 if(hit&&hit.until>now)return hit.promise;
 if(now<blockedUntil)throw new FmpQuoteError('HTTP',429);
 for(const [s,v] of cache)if(v.until<=now)cache.delete(s);
 if(cache.size>=100)throw new FmpQuoteError('HTTP',429);
 const url=new URL('https://financialmodelingprep.com/stable/quote');
 url.searchParams.set('symbol',symbol);url.searchParams.set('apikey',key);
 const item={until:Infinity,promise:(async()=>{
  return parseFmpQuote(await requestFmp(url),symbol);
 })()};
 cache.set(symbol,item);
 try{const result=await item.promise;item.until=Date.now()+5000;return result;}
 catch(e){if(cache.get(symbol)===item)cache.delete(symbol);throw e;}
}

async function requestFmp(url:URL):Promise<unknown>{
 if(Date.now()<blockedUntil)throw new FmpQuoteError('HTTP',429);
 let res:Response;
 try{res=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000),redirect:'error'});}
 catch{throw new FmpQuoteError('CONNECTION');}
 if(!res.ok){
  if(res.status===429){const h=res.headers.get('retry-after');const delay=h===null?NaN:Number(h)*1000;const date=h===null?NaN:Date.parse(h)-Date.now();blockedUntil=Math.max(blockedUntil,Date.now()+Math.max(30000,Number.isFinite(delay)?delay:Number.isFinite(date)?date:30000));}
  await res.body?.cancel().catch(()=>{});
  throw new FmpQuoteError('HTTP',res.status);
 }
 try{return await res.json();}catch{throw new FmpQuoteError('INVALID_QUOTE');}
}
type AtrResult=NonNullable<ReturnType<typeof calculateIntradayAtr>>;
const atrCache=new Map<string,{until:number;promise:Promise<AtrResult|null>}>();
export async function atrFor(symbol:string):Promise<AtrResult|null>{
 const key=process.env.FMP_API_KEY?.trim();
 if(!key)throw new FmpQuoteError('MISSING_KEY');
 const now=Date.now(),hit=atrCache.get(symbol);
 if(hit&&hit.until>now)return hit.promise;
 if(now<blockedUntil)throw new FmpQuoteError('HTTP',429);
 for(const [s,v] of atrCache)if(v.until<=now)atrCache.delete(s);
 if(atrCache.size>=100)throw new FmpQuoteError('HTTP',429);
 const url=new URL('https://financialmodelingprep.com/stable/historical-chart/5min');
 url.searchParams.set('symbol',symbol);url.searchParams.set('apikey',key);
 url.searchParams.set('from',easternClock(now-7*86400000).slice(0,10));
 url.searchParams.set('to',easternClock(now).slice(0,10));
 const item={until:Infinity,promise:(async()=>calculateIntradayAtr(await requestFmp(url),now))()};
 atrCache.set(symbol,item);
 try{
  const result=await item.promise;
  item.until=result?Math.max(Date.now()+15000,(Math.floor(now/BAR_MS)+1)*BAR_MS+10000):Date.now()+30000;
  return result;
 }catch(e){if(atrCache.get(symbol)===item)atrCache.delete(symbol);throw e;}
}
