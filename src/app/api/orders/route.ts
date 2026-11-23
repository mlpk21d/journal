import {NextRequest,NextResponse} from 'next/server';
import {authenticate} from '@/lib/security';import {db} from '@/lib/db';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const denied=authenticate(req);if(denied)return denied;
 const limit=Math.max(1,Math.min(200,Number(req.nextUrl.searchParams.get('limit'))||50));
 try{const {rows}=await db().query(`SELECT o.id,o.broker_order_id,o.symbol,o.side,o.status,o.ordered_at,o.last_seen_at,
 a.external_account_id, COALESCE((SELECT SUM(f.amount) FROM brokerage_order_fees f WHERE f.brokerage_order_id=o.id),0)::text AS order_fees,
 e.quantity AS filled_quantity,e.price AS average_fill_price,e.executed_at AS filled_at
 FROM brokerage_orders o JOIN brokerage_accounts a ON a.id=o.brokerage_account_id
 LEFT JOIN executions e ON e.brokerage_order_id=o.id AND e.source='webull_order_snapshot'
 ORDER BY o.last_seen_at DESC,o.id DESC LIMIT $1`,[limit]);
 return NextResponse.json({orders:rows});}catch(e){console.error(e);return NextResponse.json({error:'Could not load orders'}, {status:500});}
}
