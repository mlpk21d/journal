import 'server-only';
import {webull} from '@/lib/webull/client';
type Obj=Record<string,unknown>;
function obj(v:unknown):Obj{return v&&typeof v==='object'&&!Array.isArray(v)?v as Obj:{};}
function num(v:unknown):number|null{
 if(typeof v!=='number'&&(typeof v!=='string'||!v.trim()))return null;
 const n=Number(v);return Number.isFinite(n)?n:null;
}
type Cached={until:number;promise:Promise<unknown>};
const cache=new Map<string,Cached>();
async function cached<T>(key:string,ttl:number,load:()=>Promise<T>):Promise<T>{
 const now=Date.now(),existing=cache.get(key);
 if(existing&&existing.until>now)return existing.promise as Promise<T>;
 for(const [k,v] of cache)if(v.until<=now)cache.delete(k);
 if(cache.size>=100)throw new Error('Too many concurrent requests');
 const item:Cached={until:Infinity,promise:Promise.resolve().then(load)};
 cache.set(key,item);
 try{const result=await item.promise as T;item.until=Date.now()+ttl;return result;}
 catch(e){if(cache.get(key)===item)cache.delete(key);throw e;}
}
export function balanceFor(id:string){
 return cached('balance:'+id,15000,async()=>{
  const b=obj(await webull.balance(id));
  const equity=num(b.total_net_liquidation_value);
  if(b.total_asset_currency!=='USD'||equity===null||equity<=0)throw new Error('Unavailable USD account equity');
  const usd=Array.isArray(b.account_currency_assets)?b.account_currency_assets.map(obj).find(a=>a.currency==='USD'):undefined;
  const bp=num(usd?.buying_power);
  return {equity,buyingPower:bp!==null&&bp>=0?bp:null,balanceFetchedAt:Date.now()};
 });
}
export function quoteFor(symbol:string,category:'US_STOCK'|'US_ETF'){
 return cached('quote:'+category+':'+symbol,5000,async()=>{
  const raw=await webull.stockSnapshot(symbol,category);
  const row=Array.isArray(raw)?raw.map(obj).find(r=>r.symbol===symbol):undefined;
  const price=num(row?.price);
  if(price===null||price<=0)throw new Error('No quote');
  const t=num(row?.last_trade_time);
  const parsed=typeof row?.last_trade_time==='string'?Date.parse(row.last_trade_time):NaN;
  const stamp=t!==null?(t<1e12?t*1000:t):parsed;
  const quoteTime=Number.isFinite(stamp)&&stamp>0&&stamp<=Date.now()+60000?stamp:null;
  return {price,quoteTime,quoteFetchedAt:Date.now()};
 });
}
