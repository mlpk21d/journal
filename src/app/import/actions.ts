'use server';
import { headers } from 'next/headers';
import { webull, WebullRateLimitError } from '@/lib/webull/client';
import { importWebullOrders } from '@/lib/webull/import';
import { cachedAccounts, refreshAccountCache } from '@/lib/webull/accounts-cache';

export type BrokerAccount = { id: string; type: string; label: string; masked: string };
export type AccountResult = { ok: true; accounts: BrokerAccount[] } | { ok: false; error: string };
export type SyncResult =
  | { ok: true; results: Array<{ account: string; ok: boolean; scanned?: number; savedOrders?: number; savedExecutions?: number; skippedSnapshots?: number; pages?: number; error?: string }> }
  | { ok: false; error: string };

/** Temporary local-only browser boundary. Not a substitute for session auth on a deployed server. */
async function assertLocalBrowser(): Promise<void> {
  const h = await headers();
  const host = h.get('host') ?? '';
  const origin = h.get('origin');
  const localHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
  if (process.env.NODE_ENV !== 'development' || !localHost.test(host)) {
    throw new Error('Local browser import is only available on the development server');
  }
  if (origin) {
    let u: URL;
    try { u = new URL(origin); } catch { throw new Error('Invalid request origin'); }
    if (!['http:','https:'].includes(u.protocol) || u.host.toLowerCase() !== host.toLowerCase()) {
      throw new Error('Cross-origin requests are not permitted');
    }
  }
}

export async function loadWebullAccounts(): Promise<AccountResult> {
 try {
  await assertLocalBrowser();
  return {ok:true,accounts:await cachedAccounts()};
 } catch(e) { console.error('[Webull UI] Cached account query failed:',e);return {ok:false,error:'Could not load saved accounts. Apply database migrations.'}; }
}
/** UI invokes this after rendering saved accounts; refresh is throttled in PostgreSQL. */
export async function refreshWebullAccounts():Promise<AccountResult> {
 try {
  await assertLocalBrowser();
  await refreshAccountCache();
  return {ok:true,accounts:await cachedAccounts()};
 }catch(e){console.error('[Webull UI] Account refresh failed:',e);return {ok:false,error:'Cached accounts are temporarily unavailable.'};}
}
export async function syncWebullFromBrowser(accountId: string, start: string, end: string): Promise<SyncResult> {
  try {
    await assertLocalBrowser();
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateOnly.test(start) || !dateOnly.test(end)) return {ok:false,error:'Choose valid start and end dates.'};
    const startMs = Date.parse(start + 'T00:00:00.000Z');
    const endMs = Date.parse(end + 'T00:00:00.000Z') + 86400000;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs || endMs-startMs>31*86400000 || endMs>Date.now()+86400000) {
      return {ok:false,error:'Choose a date range of at most 31 days ending no later than today.'};
    }
    // Validate against the locally cached, previously discovered Webull accounts.
    // Avoid a fresh brokerage API call on every import click.
    const available=await cachedAccounts();
    const ids=available.map(a=>a.id);
    const display=(id:string)=>available.find(a=>a.id===id)?.label??'Brokerage';
    const selected=accountId==='__all__' ? ids : ids.filter(id=>id===accountId);
    if(!selected.length) return {ok:false,error:'No matching accounts available for import.'};
    const results: Array<{account:string;ok:boolean;scanned?:number;savedOrders?:number;savedExecutions?:number;skippedSnapshots?:number;pages?:number;error?:string}>=[];
    for(const id of selected){
      console.info('[Webull UI] Starting import:', {accountSuffix:id.slice(-4),start,end});
      try{
        const summary=await importWebullOrders(id,new Date(startMs).toISOString(),new Date(endMs).toISOString());
        console.info('[Webull UI] Import completed:', {accountSuffix:id.slice(-4),runId:summary.runId,scanned:summary.scanned});
        results.push({account:display(id),ok:true,scanned:summary.scanned,savedOrders:summary.savedOrders,savedExecutions:summary.savedExecutions,
          skippedSnapshots:summary.skippedSnapshots,pages:summary.pages});
      }catch(err){
        console.error('[Webull UI] Account import failed:',err);
        results.push({account:display(id),ok:false,error:err instanceof WebullRateLimitError ? 'Webull rate limit reached; import stopped. Try again later.' : 'See server terminal for error details'});
        if(err instanceof WebullRateLimitError) break;
      }
    }
    return {ok:true,results};
  } catch (error) {
    console.error('[Webull UI] Import failed:',error);
    return {ok:false,error:'Import failed. Check the Next.js terminal output for details.'};
  }
}
