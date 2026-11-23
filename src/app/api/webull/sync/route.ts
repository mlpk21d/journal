import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/security';
import { importWebullOrders } from '@/lib/webull/import';
export const runtime='nodejs';
export const maxDuration=300;
export async function POST(req:NextRequest){
 const denied=authenticate(req);if(denied)return denied;
 let input:unknown;try{input=await req.json();}catch{return NextResponse.json({error:'Invalid JSON'}, {status:400});}
 if(!input || typeof input!=='object' || Array.isArray(input)) return NextResponse.json({error:'Expected JSON object'}, {status:400});
 const v=input as Record<string,unknown>;
 const accountId=v.account_id, start=v.start_time,end=v.end_time;
 const iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
 if(typeof accountId!=='string'|| !/^[a-zA-Z0-9_-]{6,80}$/.test(accountId)||typeof start!=='string'||typeof end!=='string'||!iso.test(start)||!iso.test(end)||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start)||Date.parse(end)-Date.parse(start)>31*86400000)
 return NextResponse.json({error:'Provide account_id and UTC start_time/end_time (millisecond ISO), max 31-day range'}, {status:400});
 try{return NextResponse.json(await importWebullOrders(accountId,start,end));}
 catch(e){console.error('Webull sync failed',e);return NextResponse.json({error:'Webull sync failed; inspect server logs and import_runs'}, {status:502});}
}
