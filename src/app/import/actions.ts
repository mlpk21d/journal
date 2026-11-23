import { headers } from 'next/headers';
import { webull } from '@/lib/webull/client';
import { importWebullOrders } from '@/lib/webull/import';
import { object, stringField } from '@/lib/webull/normalize';

export type BrokerAccount = { id: string; type: string };
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
  'use server';
  try {
    await assertLocalBrowser();
    const result = await webull.accounts();
    // Webull's Trading API has shipped array and data-array account responses.
    const rows: unknown = Array.isArray(result) ? result : object(result)?.data;
    if (!Array.isArray(rows)) throw new Error('Unexpected Webull account-list response');
    const accounts: BrokerAccount[] = rows.flatMap(entry => {
      const a = object(entry);
      if (!a) return [];
      const id = stringField(a,'account_id');
      return id && /^[a-zA-Z0-9_-]{6,80}$/.test(id)
        ? [{ id, type: stringField(a,'account_type') ?? 'Brokerage' }]
        : [];
    });
    if (!accounts.length) return {ok:false,error:'Webull returned no supported brokerage accounts.'};
    return {ok:true, accounts};
  } catch (error) {
    console.error('[Webull UI] Account discovery failed:',error);
    return {ok:false,error:'Account discovery failed. Check the Next.js terminal output.'};
  }
}

export async function syncWebullFromBrowser(accountId: string, start: string, end: string): Promise<SyncResult> {
  'use server';
  try {
    await assertLocalBrowser();
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateOnly.test(start) || !dateOnly.test(end)) return {ok:false,error:'Choose valid start and end dates.'};
    const startMs = Date.parse(start + 'T00:00:00.000Z');
    const endMs = Date.parse(end + 'T00:00:00.000Z') + 86400000;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs || endMs-startMs>31*86400000 || endMs>Date.now()+86400000) {
      return {ok:false,error:'Choose a date range of at most 31 days ending no later than today.'};
    }
    // Never trust a browser-supplied account ID; re-fetch from Webull on the server.
    const data = await webull.accounts();
    const rows = Array.isArray(data) ? data : object(data)?.data;
    if (!Array.isArray(rows)) return {ok:false,error:'Webull account discovery returned an unexpected response.'};
    const ids=[...new Set(rows.flatMap(x=>{
      const item=object(x);const id=item ? stringField(item,'account_id') : null;
      return id && /^[a-zA-Z0-9_-]{6,80}$/.test(id) ? [id]:[];
    }))];
    const selected=accountId==='__all__' ? ids : ids.filter(id=>id===accountId);
    if(!selected.length) return {ok:false,error:'No matching accounts available for import.'};
    const results: Array<{account:string;ok:boolean;scanned?:number;savedOrders?:number;savedExecutions?:number;skippedSnapshots?:number;pages?:number;error?:string}>=[];
    for(const id of selected){
      console.info('[Webull UI] Starting import:', {accountSuffix:id.slice(-4),start,end});
      try{
        const summary=await importWebullOrders(id,new Date(startMs).toISOString(),new Date(endMs).toISOString());
        console.info('[Webull UI] Import completed:', {accountSuffix:id.slice(-4),runId:summary.runId,scanned:summary.scanned});
        results.push({account:id.slice(-4),ok:true,scanned:summary.scanned,savedOrders:summary.savedOrders,savedExecutions:summary.savedExecutions,
          skippedSnapshots:summary.skippedSnapshots,pages:summary.pages});
      }catch(err){
        console.error('[Webull UI] Account import failed:',err);
        results.push({account:id.slice(-4),ok:false,error:'See server terminal for error details'});
      }
    }
    return {ok:true,results};
  } catch (error) {
    console.error('[Webull UI] Import failed:',error);
    return {ok:false,error:'Import failed. Check the Next.js terminal output for details.'};
  }
}
