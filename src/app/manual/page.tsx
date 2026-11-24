import Link from 'next/link';
import {headers} from 'next/headers';
import {db} from '@/lib/db';
import {displayAccount} from '@/lib/review/account-label';
import ManualTradeEditor,{type AccountOption,type ManualTradeRow} from '@/features/manual-trades/editor';
export const dynamic='force-dynamic';
export default async function ManualPage(){
 const h=await headers();
 const local=/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(h.get('host')??'');
 if(!local||process.env.NODE_ENV!=='development'){
  return <main className="shell"><p className="notice">Manual trades are only available on local development until authentication is installed.</p></main>;
 }
 let accounts:AccountOption[]=[];
 let trades:ManualTradeRow[]=[];
 let error='';
 try{
  const {rows:accountRows}=await db().query<{id:string;broker:string;external_account_id:string;account_type:string|null;user_label:string|null}>(
   "SELECT id::text,broker,external_account_id,account_type,user_label FROM brokerage_accounts WHERE broker IN ('webull','manual') ORDER BY broker,id");
  accounts=accountRows.map(a=>({id:a.id,label:displayAccount(a)}));
  const {rows}=await db().query<{
   id:string;account_id:string;symbol:string;date:string;time:string;
   side:'BUY'|'SELL';entry_type:'OPENING'|'TRADE';quantity:string;price:string;fees:string;notes:string
  }>(`SELECT id::text,brokerage_account_id::text AS account_id,symbol,
   to_char(executed_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS date,
   to_char(executed_at AT TIME ZONE 'UTC','HH24:MI') AS time,
   side,entry_type,quantity::text,price::text,fees::text,notes
   FROM manual_trades ORDER BY executed_at DESC,id DESC LIMIT 500`);
  trades=rows.map(r=>({id:r.id,accountId:r.account_id,symbol:r.symbol,date:r.date,
   time:r.time,side:r.side,entryType:r.entry_type,quantity:r.quantity,price:r.price,fees:r.fees,notes:r.notes}));
 }catch(e){console.error('[Manual trades] Page failed',e);error='Unable to load manual trades. Run npm run db:migrate and check the terminal.';}
 return <main className="shell"><header><Link href="/" className="brand">TRADE / JOURNAL</Link><span className="muted">Manual entries</span></header>
 <section className="page-title"><p className="eyebrow">TRADE ACCOUNTING</p><h1>Manual trades</h1>
 <p className="intro">Add, edit and delete manually entered stock buys and sells, or record older opening shares. Entries remain separate from Webull transactions.</p></section>
 {error?<p className="notice">{error}</p>:<ManualTradeEditor accounts={accounts} trades={trades}
  description="Record a manual BUY or SELL with account, date, time, quantity, price and fees. For shares received before your imported history, choose Opening shares."/>}
 <footer><Link href="/performance">View provisional performance ↗</Link><span>Manually supplied values remain unverified.</span></footer>
 </main>;
}
