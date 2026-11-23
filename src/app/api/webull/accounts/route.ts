import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/security';
import { webull, WebullApiError } from '@/lib/webull/client';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  const denied = authenticate(req); if (denied) return denied;
  try { return NextResponse.json(await webull.accounts()); }
  catch (e) {
    if (e instanceof WebullApiError) {
      console.error('Webull accounts API error', {status:e.status,code:e.code});
      return NextResponse.json({
        error:'Webull account request failed',
        upstream_status:e.status,
        ...(e.code ? {upstream_code:e.code} : {})
      }, {status:502});
    }
    console.error('Webull account connection error', e instanceof Error ? e.name : 'UnknownError');
    return NextResponse.json({error:'Webull account connection failed; check server terminal for error type'}, {status:502});
  }
}
