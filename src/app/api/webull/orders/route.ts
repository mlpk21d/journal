import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/security';
import { webull } from '@/lib/webull/client';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  const denied = authenticate(req); if (denied) return denied;
  const p = req.nextUrl.searchParams;
  const account = p.get('account_id'), start = p.get('start_time'), end = p.get('end_time');
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
  if (!account || !/^[a-zA-Z0-9_-]{6,80}$/.test(account) || !start || !end || !iso.test(start) || !iso.test(end) || Date.parse(start) > Date.parse(end))
    return NextResponse.json({error:'Valid account_id, start_time and end_time (UTC ISO timestamps) are required'}, {status:400});
  try { return NextResponse.json(await webull.orders(account, start, end, p.get('pagination_key') ?? undefined)); }
  catch(e) { console.error('Webull orders lookup failed',e); return NextResponse.json({error:'Unable to query Webull orders'}, {status:502}); }
}
