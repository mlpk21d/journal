import { signingHeaders } from './signature';
type JsonValue = Record<string, unknown> | unknown[];
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
  if (!res.ok) throw new Error(`Webull request failed (${res.status}); verify API access and token`);
  return await res.json() as JsonValue;
}
export const webull = {
  accounts: () => get(PATHS.accounts),
  orders: (accountId: string, start: string, end: string, paginationKey?: string) =>
    get(PATHS.orderHistory, { account_id: accountId, start_time: start, end_time: end, ...(paginationKey ? {pagination_key:paginationKey}: {}) }),
  orderDetail: (accountId: string, clientOrderId?: string, orderId?: string) =>
    get(PATHS.orderDetail, {account_id:accountId,...(clientOrderId?{client_order_id:clientOrderId}:{}),...(orderId?{order_id:orderId}:{})}),
};
