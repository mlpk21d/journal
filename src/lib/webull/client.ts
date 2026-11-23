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
async function get(path: string, params: Record<string,string> = {}): Promise<JsonValue> {
  const {host, headers} = signingHeaders(path, params);
  const url = new URL('https://' + host + path);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  const res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(15000) });
  const raw = await res.text();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { parsed = null; }
  if (!res.ok) throw new WebullApiError(res.status,errorCode(parsed));
  if (!parsed || typeof parsed !== 'object') throw new WebullApiError(res.status,'INVALID_RESPONSE');
  return parsed as JsonValue;
}
export const webull = {
  accounts: () => get(PATHS.accounts),
  orders: (accountId: string, start: string, end: string, paginationKey?: string) =>
    get(PATHS.orderHistory, { account_id: accountId, start_time: start, end_time: end, ...(paginationKey ? {pagination_key:paginationKey}: {}) }),
  orderDetail: (accountId: string, clientOrderId?: string, orderId?: string) =>
    get(PATHS.orderDetail, {account_id:accountId,...(clientOrderId?{client_order_id:clientOrderId}:{}),...(orderId?{order_id:orderId}:{})}),
};
