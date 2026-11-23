import { createHash, createHmac, randomUUID } from 'node:crypto';
export function signature(input: { path: string; query?: Record<string, string>; body?: string; appKey: string; appSecret: string; host: string; timestamp: string; nonce: string }): string {
  const values: Record<string, string> = {
    ...(input.query ?? {}), host: input.host,
    'x-app-key': input.appKey,
    'x-signature-algorithm': 'HMAC-SHA1',
    'x-signature-nonce': input.nonce,
    'x-signature-version': '1.0',
    'x-timestamp': input.timestamp,
  };
  const joined = Object.keys(values).sort().map(k => `${k}=${values[k]}`).join('&');
  const raw = input.path + '&' + joined + (input.body ? '&' + createHash('md5').update(input.body).digest('hex').toUpperCase() : '');
  // URL encoding follows Webull's documented percent-encoding example.
  const encoded = encodeURIComponent(raw).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase());
  return createHmac('sha1', input.appSecret + '&').update(encoded).digest('base64');
}
export function signingHeaders(path: string, query: Record<string,string> = {}) {
  const appKey = process.env.WEBULL_APP_KEY;
  const appSecret = process.env.WEBULL_APP_SECRET;
  if (!appKey || !appSecret) throw new Error('Webull credentials are missing');
  const host = process.env.WEBULL_ENV === 'production' ? 'api.webull.com' : 'api.sandbox.webull.com';
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const nonce = randomUUID().replace(/-/g, '');
  const headers: Record<string,string> = {
    'Accept': 'application/json', 'x-app-key': appKey,
    'x-timestamp': timestamp, 'x-signature-algorithm': 'HMAC-SHA1',
    'x-signature-version': '1.0', 'x-signature-nonce': nonce, 'x-version': 'v3'
  };
  // 2FA is opt-in: stale tokens must not be sent to applications with 2FA disabled.
  if (process.env.WEBULL_USE_ACCESS_TOKEN === 'true') {
    const token = process.env.WEBULL_ACCESS_TOKEN?.trim();
    if (!token) throw new Error('WEBULL_USE_ACCESS_TOKEN=true but WEBULL_ACCESS_TOKEN is missing');
    headers['x-access-token'] = token;
  }
  headers['x-signature'] = signature({path,query,appKey,appSecret,host,timestamp,nonce});
  return { host, headers };
}
