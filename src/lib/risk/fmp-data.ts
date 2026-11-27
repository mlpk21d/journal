import 'server-only';
import {FmpQuoteError,parseFmpQuote} from './fmp-quote';
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
  let res:Response;
  try{res=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000),redirect:'error'});}
  catch{throw new FmpQuoteError('CONNECTION');}
  if(!res.ok){
   if(res.status===429){const h=res.headers.get('retry-after');const delay=h===null?NaN:Number(h)*1000;const date=h===null?NaN:Date.parse(h)-Date.now();blockedUntil=Math.max(blockedUntil,Date.now()+Math.max(30000,Number.isFinite(delay)?delay:Number.isFinite(date)?date:30000));}
   await res.body?.cancel().catch(()=>{});
   throw new FmpQuoteError('HTTP',res.status);
  }
  let raw:unknown;try{raw=await res.json();}catch{throw new FmpQuoteError('INVALID_QUOTE');}
  return parseFmpQuote(raw,symbol);
 })()};
 cache.set(symbol,item);
 try{const result=await item.promise;item.until=Date.now()+5000;return result;}
 catch(e){if(cache.get(symbol)===item)cache.delete(symbol);throw e;}
}
