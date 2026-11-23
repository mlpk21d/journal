import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/security';
import { db } from '@/lib/db';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  const denied = authenticate(req); if (denied) return denied;
  const limit = Math.max(1,Math.min(200,Number(req.nextUrl.searchParams.get('limit') || 50) || 50));
  try {
    const {rows} = await db().query(`SELECT e.id,e.symbol,e.side,e.quantity,e.price,e.executed_at,
      e.source,e.broker_execution_id,
      COALESCE((SELECT SUM(f.amount) FROM brokerage_order_fees f WHERE f.brokerage_order_id=e.brokerage_order_id),0)::text AS order_fees,
      COALESCE((SELECT SUM(f.amount) FROM execution_fees f WHERE f.execution_id=e.id),0)::text AS execution_fees
      FROM executions e ORDER BY e.executed_at DESC,e.id DESC LIMIT $1`,[limit]);
    return NextResponse.json({trades:rows});
  } catch(e) { console.error('Trade history lookup failed',e); return NextResponse.json({error:'Unable to load trades'}, {status:500}); }
}
