import 'server-only';
import {db} from '@/lib/db';
import type {LedgerInput} from '@/lib/performance/ledger';
import {normalizeWebullOrderFee} from '@/lib/performance/fee-policy';
import {displayAccount} from '@/lib/review/account-label';
import {headers} from 'next/headers';
import {activeAccountId} from '@/lib/review/account-scope';

export async function reviewIsLocal(){
 const host=(await headers()).get('host')??'';
 return process.env.NODE_ENV==='development'&&/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
}
export async function loadReviewLedger(accountId:string|null){
 // The persistent sidebar account takes precedence over per-page URL parameters.
 const active=await activeAccountId();
 // When a workspace account is selected it overrides any old page-level account URL.
 accountId=active??accountId;
 const accounts=(await db().query<{id:string;external_account_id:string;account_type:string|null;broker:string;user_label:string|null}>(
  'SELECT id::text,external_account_id,account_type,broker,user_label FROM brokerage_accounts ORDER BY id')).rows;
 if(accountId!==null&&!accounts.some(a=>a.id===accountId))throw new Error('Unknown account');
 const result=await db().query<{
  id:string;account_id:string;symbol:string;side:'BUY'|'SELL';quantity:string;
  price:string;executed_at:Date;fees:string|null;
 }>([
  'SELECT * FROM (',
  'SELECT e.id::text AS id,e.brokerage_account_id::text AS account_id,',
  'e.symbol,e.side,e.quantity::text,e.price::text,e.executed_at,',
  'COALESCE((SELECT SUM(f.amount) FROM brokerage_order_fees f WHERE f.brokerage_order_id=e.brokerage_order_id),0)::text AS fees',
  "FROM executions e WHERE e.source='webull_order_snapshot' AND e.instrument_type='EQUITY'",
  'AND ($1::bigint IS NULL OR e.brokerage_account_id=$1::bigint)',
  'UNION ALL',
  "SELECT 'manual:'||m.id::text AS id,m.brokerage_account_id::text AS account_id,",
  'm.symbol,m.side,m.quantity::text,m.price::text,m.executed_at,m.fees::text',
  'FROM manual_trades m WHERE ($1::bigint IS NULL OR m.brokerage_account_id=$1::bigint)',
  ') history ORDER BY executed_at ASC,id ASC LIMIT 20001'
 ].join(' '),[accountId]);
 if(result.rows.length>20000)throw new Error('LIMIT_EXCEEDED');
 const entries:LedgerInput[]=result.rows.map(row=>({
  id:row.id,accountId:row.account_id,symbol:row.symbol,side:row.side,
  quantity:row.quantity,price:row.price,executedAt:row.executed_at.toISOString(),
  ...(row.id.startsWith('manual:')?{fees:row.fees??'0',feeKnown:true}:normalizeWebullOrderFee(row.fees))
 }));
 const accountLabel=(id:string)=>{
  const a=accounts.find(x=>x.id===id);
  return a?displayAccount(a):'Unknown account';
 };
 return {entries,accounts,accountLabel};
}
