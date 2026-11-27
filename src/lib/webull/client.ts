import { signingHeaders } from './signature';
type JsonValue = Record<string, unknown> | unknown[];
export class WebullApiError extends Error {
  constructor(public readonly status: number, public readonly code: string | null) {
    super('Webull API request failed');
    this.name = 'WebullApiError';
  }
}
export class WebullRateLimitError extends WebullApiError {
  constructor() {
    super(429,'RATE_LIMITED');
    this.name='WebullRateLimitError';
  }
}
function errorCode(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input=value as Record<string, unknown>;
  const raw=input.code ?? input.error_code ?? input.errorCode;
  return typeof raw === 'string' || typeof raw === 'number' ? String(raw).slice(0,64) : null;
}
const PATHS = {
  accounts: '/trading/accounts/list',
  orderHistory: '/trading/orders/historical-orders/list',
  orderDetail: '/trading/orders/get',
} as const;

// Per-endpoint Webull limits vary. Trading history/detail each allow 2/2s,
// while account list allows 10/30s. Use a stricter serialized 1/2.5s
// pace across ALL endpoints and accounts to avoid burst windows.
const REQUEST_INTERVAL_MS=2500;
const MAX_429_RETRIES=2;
const MIN_429_BACKOFF_MS=30_000;
const MAX_429_BACKOFF_MS=120_000;
const CIRCUIT_BREAKER_MS=5*60_000;
type LimiterState = {nextRequestAt:number;blockedUntil:number;circuitOpenUntil:number;queue:Promise<void>};
const runtime=globalThis as typeof globalThis & {webullLimiter?:LimiterState};
const limiter=runtime.webullLimiter ??= {nextRequestAt:0,blockedUntil:0,circuitOpenUntil:0,queue:Promise.resolve()};
function sleep(ms:number):Promise<void>{return new Promise(resolve=>setTimeout(resolve,ms));}
async function throttle():Promise<void>{
  const turn=limiter.queue.then(async()=>{
    if(Date.now()<limiter.circuitOpenUntil) throw new WebullRateLimitError();
    const now=Date.now();
    const scheduled=Math.max(now,limiter.nextRequestAt,limiter.blockedUntil);
    limiter.nextRequestAt=scheduled+REQUEST_INTERVAL_MS;
    if(scheduled>now) await sleep(scheduled-now);
    if(Date.now()<limiter.circuitOpenUntil) throw new WebullRateLimitError();
  });
  limiter.queue=turn.catch(()=>{});
  await turn;
}
function retryDelay(header:string|null,attempt:number):number{
  let delay=NaN;
  if(header!==null){
    const seconds=Number(header);
    if(Number.isFinite(seconds)&&seconds>=0) delay=seconds*1000;
    else {
      const date=Date.parse(header);
      if(Number.isFinite(date)) delay=date-Date.now();
    }
  }
  if(!Number.isFinite(delay)) delay=MIN_429_BACKOFF_MS*2**attempt;
  return Math.min(MAX_429_BACKOFF_MS,Math.max(MIN_429_BACKOFF_MS,Math.ceil(delay)));
}
async function get(path:string,params:Record<string,string>={}):Promise<JsonValue>{
  for(let attempt=0;attempt<=MAX_429_RETRIES;attempt++){
    await throttle();
    // Every retry gets fresh timestamp, nonce, and signature.
    const {host,headers}=signingHeaders(path,params);
    const url=new URL('https://'+host+path);
    Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
    const res=await fetch(url,{headers,cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(res.status===429){
      await res.body?.cancel();
      const delay=retryDelay(res.headers.get('retry-after'),attempt);
      // Shared cooldown applies to all calls from this server process.
      limiter.blockedUntil=Math.max(limiter.blockedUntil,Date.now()+delay);
      if(attempt===MAX_429_RETRIES){
        limiter.circuitOpenUntil=Math.max(limiter.circuitOpenUntil,Date.now()+CIRCUIT_BREAKER_MS);
        console.error('[Webull] Rate limit persisted; pausing further imports for five minutes.');
        throw new WebullRateLimitError();
      }
      console.warn('[Webull] HTTP 429: shared cooldown before retry', {attempt:attempt+1,delayMs:delay});
      continue;
    }
    const raw=await res.text();
    let parsed:unknown;
    try{parsed=JSON.parse(raw);}catch{parsed=null;}
    if(!res.ok) throw new WebullApiError(res.status,errorCode(parsed));
    if(!parsed||typeof parsed!=='object') throw new WebullApiError(res.status,'INVALID_RESPONSE');
    return parsed as JsonValue;
  }
  throw new WebullRateLimitError();
}
export const webull = {
  accounts: () => get(PATHS.accounts),
  balance: (accountId:string) => get('/trading/assets/balances/get',{account_id:accountId}),
  orders: (accountId: string, start: string, end: string, paginationKey?: string) =>
    get(PATHS.orderHistory, { account_id: accountId, start_time: start, end_time: end, ...(paginationKey ? {pagination_key:paginationKey}: {}) }),
  orderDetail: (accountId: string, clientOrderId?: string, orderId?: string) =>
    get(PATHS.orderDetail, {account_id:accountId,...(clientOrderId?{client_order_id:clientOrderId}:{}),...(orderId?{order_id:orderId}:{})}),
};
