import { signingHeaders } from './signature';
type JsonValue = Record<string, unknown> | unknown[];
export class WebullApiError extends Error {
  constructor(public readonly status: number, public readonly code: string | null) {
    super('Webull API request failed');
    this.name = 'WebullApiError';
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

// Webull's account-level limit is 60 requests/minute. Target 50/minute to
// allow for timing jitter and requests outside this app. All calls made by
// this Next.js process share one serialized limiter across ALL accounts.
const REQUEST_INTERVAL_MS = 1200;
const MAX_RATE_LIMIT_RETRIES = 3;
type LimiterState = { nextRequestAt: number; queue: Promise<void> };
const runtime = globalThis as typeof globalThis & { webullLimiter?: LimiterState };
const limiter = runtime.webullLimiter ??= {nextRequestAt:0,queue:Promise.resolve()};
function sleep(ms: number): Promise<void> {
  return new Promise(resolve=>setTimeout(resolve,ms));
}
async function throttle(): Promise<void> {
  const turn = limiter.queue.then(async()=>{
    const now=Date.now();
    const scheduled=Math.max(now,limiter.nextRequestAt);
    limiter.nextRequestAt=scheduled+REQUEST_INTERVAL_MS;
    if(scheduled>now) await sleep(scheduled-now);
  });
  limiter.queue=turn.catch(()=>{});
  await turn;
}
function retryDelay(header: string | null, attempt: number): number {
  const seconds=header!==null ? Number(header) : NaN;
  if(Number.isFinite(seconds) && seconds >= 0) return Math.min(120_000,Math.max(1000,Math.ceil(seconds*1000)));
  if(header) {
    const date=Date.parse(header);
    if(Number.isFinite(date)) return Math.min(120_000,Math.max(1000,date-Date.now()));
  }
  return Math.min(60_000,5000*2**attempt);
}
async function get(path: string, params: Record<string,string> = {}): Promise<JsonValue> {
  const urlParams = new URLSearchParams(params);
  for(let attempt=0;attempt<=MAX_RATE_LIMIT_RETRIES;attempt++){
    // Re-sign on every attempt to refresh timestamp and nonce.
    await throttle();
    const {host,headers} = signingHeaders(path,params);
    const url = new URL('https://' + host + path);
    url.search=urlParams.toString();
    const res=await fetch(url,{headers,cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(res.status===429 && attempt<MAX_RATE_LIMIT_RETRIES){
      const delay=retryDelay(res.headers.get('retry-after'),attempt);
      console.warn('[Webull] HTTP 429: waiting before retry', {attempt:attempt+1,delayMs:delay});
      await res.body?.cancel();
      await sleep(delay);
      continue;
    }
    const raw=await res.text();
    let parsed:unknown;
    try{parsed=JSON.parse(raw);}catch{parsed=null;}
    if(!res.ok) throw new WebullApiError(res.status,errorCode(parsed));
    if(!parsed || typeof parsed!=='object') throw new WebullApiError(res.status,'INVALID_RESPONSE');
    return parsed as JsonValue;
  }
  throw new WebullApiError(429,'RATE_LIMITED');
}
export const webull = {
  accounts: () => get(PATHS.accounts),
  orders: (accountId: string, start: string, end: string, paginationKey?: string) =>
    get(PATHS.orderHistory, { account_id: accountId, start_time: start, end_time: end, ...(paginationKey ? {pagination_key:paginationKey}: {}) }),
  orderDetail: (accountId: string, clientOrderId?: string, orderId?: string) =>
    get(PATHS.orderDetail, {account_id:accountId,...(clientOrderId?{client_order_id:clientOrderId}:{}),...(orderId?{order_id:orderId}:{})}),
};
