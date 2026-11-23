import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
export function authenticate(req: NextRequest): NextResponse | null {
  const expected = process.env.JOURNAL_API_TOKEN;
  if (!expected) return NextResponse.json({ error: 'JOURNAL_API_TOKEN is not configured' }, { status: 503 });
  const supplied = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(expected); const b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
