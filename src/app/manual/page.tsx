import Link from 'next/link';
import {headers} from 'next/headers';
import {db} from '@/lib/db';
import {cachedAccounts} from '@/lib/webull/accounts-cache';
import ManualLotsEditor from './editor';
export const dynamic='force-dynamic';
export default async function ManualPage(){
 const h=await headers();
 const local=/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(h.get('host')??'');
 if(!local||process.env.NODE_ENV!=='development'){
  return <main className="shell"><p className="notice">Manual positions are only available on local development until authentication is installed.</p></main>;
 }
 let accounts:{id:string;label:string}[]=[];
 let lots:{id:string;accountId:string;symbol:string;date:string;quantity:string;basis:string;notes:string}[]=[];
 let error='';
 try{
  const saved=await cachedAccounts();
  const {rows:accountRows}=await db().query<{id:string;external_account_id:string}>(`SELECT id::text,external_account_id FROM brokerage_accounts WHERE broker='webull'`);
  const byExternal=new Map(accountRows.map(x=>[x.external_account_id,x.id]));
  accounts=saved.flatMap(x=>{const id=byExternal.get(x.id);return id?[{id,label:x.label}]:[];});
  const {rows}=await db().query<{id:string;account_id:string;symbol:string;date:string;quantity:string;basis:string;notes:string}>(`
    SELECT id::text,brokerage_account_id::text AS account_id,symbol,
    to_char(acquired_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS date,
    quantity::text,unit_basis::text AS basis,notes
    FROM manual_opening_lots ORDER BY acquired_at DESC,id DESC LIMIT 300`);
  lots=rows.map(r=>({...r,accountId:r.account_id}));
 }catch(e){console.error('[Manual lots] Page failed',e);error='Could not load manual holdings. Run npm run db:migrate and check the terminal.';}
 return <main className="shell"><header><Link href="/" className="brand">TRADE / JOURNAL</Link><span className="muted">Manual acquisition records</span></header>
 <section className="page-title"><p className="eyebrow">HISTORICAL COST BASIS</p><h1>Manual opening lots</h1>
 <p className="intro">Record stock shares acquired before your imported trading history. The original acquisition date and cost basis are used in provisional FIFO matching. No Webull orders are created.</p></section>
 {error?<p className="notice">{error}</p>:<ManualLotsEditor accounts={accounts} lots={lots}/>}
 <footer><Link href="/performance">View provisional performance ↗</Link><span>All manual opening lots remain unverified until reconciled.</span></footer>
 </main>;
}
