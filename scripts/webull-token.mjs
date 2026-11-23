import { createHash, createHmac, randomUUID } from 'node:crypto';
import { writeFileSync, readFileSync } from 'node:fs';

const appKey = process.env.WEBULL_APP_KEY;
const secret = process.env.WEBULL_APP_SECRET;
if (!appKey || !secret) {
  console.error('WEBULL_APP_KEY and WEBULL_APP_SECRET are required in .env.local');
  process.exit(1);
}
const env = process.env.WEBULL_ENV === 'production' ? 'production' : 'sandbox';
const host = env === 'production' ? 'api.webull.com' : 'api.sandbox.webull.com';
const path = '/auth/tokens/create';
const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const nonce = randomUUID().replace(/-/g, '');
const signed = {
  host,
  'x-app-key': appKey,
  'x-signature-algorithm': 'HMAC-SHA1',
  'x-signature-nonce': nonce,
  'x-signature-version': '1.0',
  'x-timestamp': timestamp,
};
const canonical = path + '&' + Object.keys(signed).sort().map(k => `${k}=${signed[k]}`).join('&');
const encoded = encodeURIComponent(canonical).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const signature = createHmac('sha1', secret + '&').update(encoded).digest('base64');
const headers = {
  Accept: 'application/json',
  'x-app-key': appKey,
  'x-timestamp': timestamp,
  'x-signature-algorithm': 'HMAC-SHA1',
  'x-signature-version': '1.0',
  'x-signature-nonce': nonce,
  'x-version': 'v3',
  'x-signature': signature,
};
try {
  const response = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  const raw = await response.text();
  let data; try { data = JSON.parse(raw); } catch { data = null; }
  if (!response.ok) {
    const code = data && typeof data === 'object' ? data.error_code ?? data.code : null;
    console.error('Webull token creation failed.', { status: response.status, code: code ?? 'UNKNOWN' });
    process.exitCode = 1;
  } else if (!data || typeof data.token !== 'string' || !/^[0-9a-f]{32}$/i.test(data.token)) {
    console.error('Unexpected token response. No credentials were written.');
    process.exitCode = 1;
  } else {
    const envFile = '.env.local';
    let existing = readFileSync(envFile, 'utf8');
    const entry = 'WEBULL_ACCESS_TOKEN=' + data.token;
    if (/^WEBULL_ACCESS_TOKEN=.*$/m.test(existing)) {
      existing = existing.replace(/^WEBULL_ACCESS_TOKEN=.*$/m, entry);
    } else {
      existing += (existing.endsWith('\n') ? '' : '\n') + entry + '\n';
    }
    writeFileSync(envFile, existing, { mode: 0o600 });
    console.log('Webull token created and saved locally to .env.local (not printed).');
    console.log('Environment:', env, '| status:', data.status ?? 'PENDING');
    console.log('Complete Webull mobile app verification within 5 minutes.');
    console.log('Webull app: Menu > Messages > OpenAPI Notifications > Check Now.');
    console.log('After verification, restart Next.js and retry /api/webull/accounts.');
  }
} catch (error) {
  console.error('Webull token request failed:', error instanceof Error ? error.name : 'UNKNOWN');
  process.exitCode = 1;
}
