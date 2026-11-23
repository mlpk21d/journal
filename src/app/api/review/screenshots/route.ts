import {NextRequest,NextResponse} from 'next/server';
import {MAX_BYTES,requireLocalScreenshotAccess,verifiedJournal,listScreenshots,saveScreenshot,removeScreenshot} from '@/lib/review/screenshots';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const fail=(msg:string,status=400)=>NextResponse.json({error:msg},{status,headers:{'Cache-Control':'no-store'}});
function errorResponse(error:unknown){
 const e=error as {code?:string;message?:string};
 if(e.code==='42P01')return fail('Run npm run db:migrate to apply migration 007',503);
 const known=['Invalid','Trade changed','Save the journal','Only valid','Screenshot must','Maximum','Screenshot not found','Missing origin','Cross-origin'];
 if(known.some(x=>e.message?.startsWith(x)))return fail(e.message!);
 console.error('[Screenshots] Request error',error);
 return fail('Screenshot request failed. Check the server terminal.',500);
}
export async function GET(request:NextRequest){
 try{
  await requireLocalScreenshotAccess();
  const u=new URL(request.url);
  const journal=await verifiedJournal(u.searchParams.get('cycleKey')??'',u.searchParams.get('fingerprint')??'');
  return NextResponse.json({screenshots:await listScreenshots(journal.id)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return errorResponse(e);}
}
export async function POST(request:NextRequest){
 try{
  await requireLocalScreenshotAccess(true);
  if(Number(request.headers.get('content-length')??0)>MAX_BYTES+131072)return fail('Upload exceeds 5 MB',413);
  const form=await request.formData(),file=form.get('file');
  if(!(file instanceof File))return fail('Select an image');
  if(file.size===0||file.size>MAX_BYTES)return fail('Screenshot must be between 1 byte and 5 MB',413);
  const journal=await verifiedJournal(String(form.get('cycleKey')??''),String(form.get('fingerprint')??''));
  await saveScreenshot(journal.id,new Uint8Array(await file.arrayBuffer()),file.type);
  return NextResponse.json({screenshots:await listScreenshots(journal.id)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return errorResponse(e);}
}
export async function DELETE(request:NextRequest){
 try{
  await requireLocalScreenshotAccess(true);
  const body=await request.json() as {cycleKey?:unknown;fingerprint?:unknown;id?:unknown};
  if(typeof body.cycleKey!=='string'||typeof body.fingerprint!=='string'||typeof body.id!=='string')return fail('Invalid request');
  const journal=await verifiedJournal(body.cycleKey,body.fingerprint);
  await removeScreenshot(journal.id,body.id);
  return NextResponse.json({screenshots:await listScreenshots(journal.id)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return errorResponse(e);}
}
