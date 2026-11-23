import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/security';
import { webull } from '@/lib/webull/client';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  const denied = authenticate(req); if (denied) return denied;
  try { return NextResponse.json(await webull.accounts()); }
  catch (e) { console.error('Webull accounts lookup failed', e); return NextResponse.json({error:'Unable to query Webull accounts'}, {status:502}); }
}
