import {NextResponse} from 'next/server';
import {requireLocalScreenshotAccess,screenshotFile} from '@/lib/review/screenshots';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  await requireLocalScreenshotAccess();
  const file=await screenshotFile((await params).id);
  if(!file)return new NextResponse('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
  return new NextResponse(new Uint8Array(file.bytes),{headers:{
   'Content-Type':file.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store',
   'Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'; sandbox"
  }});
 }catch(e){console.error('[Screenshots] View failed',e);return new NextResponse('Unavailable',{status:403,headers:{'Cache-Control':'no-store'}});}
}
