import Link from 'next/link';
import {db} from '@/lib/db';
import {displayAccount} from '@/lib/review/account-label';
import {reviewIsLocal} from '@/lib/review/server';
import {SchwabCsvForm} from '@/components/schwab-csv-form';
export const dynamic='force-dynamic';
export default async function SchwabImportPage(){
 if(!await reviewIsLocal())return <main className="shell"><p className="notice">Schwab CSV import is restricted to localhost development.</p></main>;
 let accounts:{id:string;label:string}[]=[],error='';
 try{
  const r=await db().query<{id:string;broker:string;external_account_id:string;account_type:string|null;user_label:string|null}>(
   "SELECT id::text,broker,external_account_id,account_type,user_label FROM brokerage_accounts WHERE broker IN ('schwab','manual') ORDER BY broker,id");
  accounts=r.rows.map(a=>({id:a.id,label:displayAccount(a)}));
 }catch(e){console.error('[Schwab CSV] Accounts unavailable',e);error='Unable to load accounts. Check database and migrations.';}
 return <main className="shell">
  <header><Link href="/" className="brand">TRADE / JOURNAL</Link><span className="muted">Schwab CSV Import</span></header>
  <section className="page-title"><p className="eyebrow">TRANSACTION HISTORY</p><h1>Import Charles Schwab CSV</h1>
   <p className="intro">Upload a Schwab Transactions export into a specific existing account. Buy, Sell and Sell Short entries become FIFO source trades; trade commissions remain attached to those trades. Service Fees go into the separate Fees ledger. Wire Sent, transfers, adjustments and interest are excluded.</p>
  </section>
  {error?<p className="notice" role="alert">{error}</p>:<SchwabCsvForm accounts={accounts}/>}
  <p className="notice">Because Schwab's CSV has dates without times, imported trades receive distinct estimated times from 9:30 AM Eastern onward, sorted oldest to newest by reversing the export's within-day order. The sequence is provisional. Before relying on FIFO P&amp;L, verify these assumptions against your statement.</p>
  <p className="helper"><Link href="/import">← Webull import</Link> · <Link href="/fees">Fees</Link> · <Link href="/settings">Manage accounts</Link></p>
 </main>;
}
