import { NextRequest,NextResponse } from 'next/server';
import {authenticate} from '@/lib/security';
import {db} from '@/lib/db';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const denied=authenticate(req);if(denied)return denied;
 try{const {rows}=await db().query(`SELECT r.id,r.started_at,r.finished_at,r.start_time,r.end_time,r.status,r.scanned_orders,r.saved_orders,r.saved_executions,r.message,a.external_account_id FROM import_runs r JOIN brokerage_accounts a ON a.id=r.brokerage_account_id ORDER BY r.started_at DESC LIMIT 30`);
 return NextResponse.json({runs:rows});}catch(e){console.error(e);return NextResponse.json({error:'Could not load import runs'}, {status:500});}
}
