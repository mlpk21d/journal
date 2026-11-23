import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/security';
import { db } from '@/lib/db';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  const denied = authenticate(req); if (denied) return denied;
  try { await db().query('SELECT 1'); return NextResponse.json({ database:'ok' }); }
  catch { return NextResponse.json({database:'unavailable'}, {status:503}); }
}
