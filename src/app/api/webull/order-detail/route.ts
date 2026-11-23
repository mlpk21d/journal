import { NextRequest,NextResponse } from 'next/server';
import {authenticate} from '@/lib/security';
import {webull} from '@/lib/webull/client';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const denied=authenticate(req);if(denied)return denied;
 const a=req.nextUrl.searchParams.get('account_id');
 const c=req.nextUrl.searchParams.get('client_order_id');
 const o=req.nextUrl.searchParams.get('order_id');
 if(!a||!/^[a-zA-Z0-9_-]{6,80}$/.test(a)||(!c&&!o)||[c,o].some(x=>x!==null&&(x.length>120||!/^[a-zA-Z0-9_-]+$/.test(x))))
 return NextResponse.json({error:'Provide account_id and client_order_id or order_id'}, {status:400});
 try{return NextResponse.json(await webull.orderDetail(a,c??undefined,o??undefined));}
 catch(e){console.error('Webull order detail failed',e);return NextResponse.json({error:'Webull order detail unavailable'}, {status:502});}
}
