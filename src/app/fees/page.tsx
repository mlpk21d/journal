import Link from 'next/link';
import {db} from '@/lib/db';
import {reviewIsLocal} from '@/lib/review/server';
import {activeAccountId} from '@/lib/review/account-scope';
import {displayAccount} from '@/lib/review/account-label';
import {AccountFees,type FeeRow} from '@/components/account-fees';
export const dynamic='force-dynamic';
export default async function FeesPage(){
 if(!await reviewIsLocal())return <main className="shell"><p className="notice">Account fees are restricted to the local development workspace.</p></main>;
 const selected=await activeAccountId();
 let accounts:{id:string;label:string}[]=[],rows:FeeRow[]=[],error='';
 try{
  const source=(await db().query<{id:string;broker:string;external_account_id:string;account_type:string|null;user_label:string|null}>(
   'SELECT id::text,broker,external_account_id,account_type,user_label FROM brokerage_accounts ORDER BY broker,id')).rows;
  accounts=source.map(a=>({id:a.id,label:displayAccount(a)}));
  const data=await db().query<{id:string;account_id:string;fee_date:string;fee_type:string;description:string;amount:string;source:string}>(
   "SELECT id::text,brokerage_account_id::text AS account_id,fee_date::text,fee_type,description,amount::text,source FROM account_fees WHERE ($1::bigint IS NULL OR brokerage_account_id=$1::bigint) ORDER BY fee_date DESC,id DESC LIMIT 2000",
   [selected]);
  rows=data.rows.map(r=>({id:r.id,accountId:r.account_id,accountName:accounts.find(a=>a.id===r.account_id)?.label??'Unknown',date:r.fee_date,type:r.fee_type,description:r.description,amount:r.amount,source:r.source}));
 }catch(e){console.error('[Fees] Unable to load',e);error='Unable to load fees. Run npm run db:migrate and check the terminal.';}
 return <main className="shell">
  <header><Link href="/" className="brand">TRADE / JOURNAL</Link><span className="muted">Account fees</span></header>
  <section className="page-title"><p className="eyebrow">BROKERAGE EXPENSES</p><h1>Fees</h1>
   <p className="intro">Track standalone broker charges separately from per-trade commissions. Schwab CSV Service Fee rows are imported here automatically. Add Webull, Schwab, or other charges by account and date.</p>
  </section>
  {error?<p role="alert" className="notice">{error}</p>:<AccountFees accounts={accounts} rows={rows} selected={selected}/>}
  <p className="notice">These are standalone account fees, not trade commissions. They are shown separately and are not subtracted again from FIFO trade P&amp;L. Commissions already included on trade fills remain allocated by the FIFO matching engine.</p>
 </main>;
}
