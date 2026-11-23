import { db } from '@/lib/db';
import { webull } from './client';
import { normalizeOrder, normalizeSnapshot, detailOrder, orderFees, orderPages, type Obj } from './normalize';
export type ImportSummary={runId:string;pages:number;scanned:number;savedOrders:number;savedExecutions:number;skippedSnapshots:number;status:'completed'};
export async function importWebullOrders(accountId:string,start:string,end:string):Promise<ImportSummary> {
 const pool=db();
 // Prevent simultaneous syncs for the same account, including across server processes.
 const conn=await pool.connect();
 let runId:string|null=null,locked=false;
 try {
  const key=accountId;
  const lock=await conn.query<{locked:boolean}>('SELECT pg_try_advisory_lock(hashtext($1), 740113) AS locked',[key]);
  if(!lock.rows[0]?.locked) throw new Error('A sync is already running for this account');
  locked=true;
  const acct=await conn.query<{id:string}>(`INSERT INTO brokerage_accounts(broker,external_account_id) VALUES('webull',$1)
  ON CONFLICT (broker,external_account_id) DO UPDATE SET external_account_id=EXCLUDED.external_account_id RETURNING id`,[accountId]);
  const localId=acct.rows[0].id;
  const run=await conn.query<{id:string}>(`INSERT INTO import_runs(brokerage_account_id,start_time,end_time) VALUES($1,$2,$3) RETURNING id`,[localId,start,end]);
  runId=run.rows[0].id;
  let cursor:string|undefined;
  const cursors=new Set<string>();
  let pages=0,scanned=0,savedOrders=0,savedExecutions=0,skippedSnapshots=0;
  do {
   if(pages>=100) throw new Error('Pagination limit exceeded (100 pages): narrow date range');
   const result=orderPages(await webull.orders(accountId,start,end,cursor));
   pages++;
   for(const item of result.orders){
    scanned++;
    const order=normalizeOrder(item);
    if(!order) {skippedSnapshots++;continue;}
    let detail:Obj=item;
    if(order.clientOrderId){
     const raw=await webull.orderDetail(accountId,order.clientOrderId);
     detail=detailOrder(raw,item);
    }
    const normalized=normalizeOrder(detail) ?? order;
    await conn.query('BEGIN');
    try{
     const row=await conn.query<{id:string}>(`INSERT INTO brokerage_orders(brokerage_account_id,broker_order_id,client_order_id,symbol,side,status,ordered_at,raw_payload)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
      ON CONFLICT(brokerage_account_id,broker_order_id)
      DO UPDATE SET client_order_id=EXCLUDED.client_order_id,symbol=EXCLUDED.symbol,side=EXCLUDED.side,status=EXCLUDED.status,
      ordered_at=COALESCE(EXCLUDED.ordered_at,brokerage_orders.ordered_at),raw_payload=EXCLUDED.raw_payload,last_seen_at=now()
      RETURNING id`,[localId,order.brokerOrderId,normalized.clientOrderId,normalized.symbol,normalized.side,normalized.status,normalized.orderedAt,JSON.stringify(detail)]);
     const orderId=row.rows[0].id;
     // Order-level fees are never assigned to individual snapshots or counted per fill.
     const fees=orderFees(detail);
     await conn.query('DELETE FROM brokerage_order_fees WHERE brokerage_order_id=$1',[orderId]);
     for(const fee of fees) await conn.query(`INSERT INTO brokerage_order_fees(brokerage_order_id,fee_type,amount) VALUES($1,$2,$3)`,[orderId,fee.type,fee.amount]);
     const snapshot=normalizeSnapshot(detail);
     if(snapshot){
      // This record is an order-level weighted average, NOT an exchange-level fill.
      // A dedicated source marker keeps it out of future true execution imports.
      await conn.query(`INSERT INTO executions(brokerage_account_id,brokerage_order_id,source,broker_execution_id,symbol,side,quantity,price,executed_at,raw_payload)
      VALUES($1,$2,'webull_order_snapshot',NULL,$3,$4,$5,$6,$7,$8::jsonb)
      ON CONFLICT(brokerage_order_id) WHERE source='webull_order_snapshot'
      DO UPDATE SET symbol=EXCLUDED.symbol,side=EXCLUDED.side,quantity=EXCLUDED.quantity,price=EXCLUDED.price,
      executed_at=EXCLUDED.executed_at,raw_payload=EXCLUDED.raw_payload`,[localId,orderId,snapshot.symbol,snapshot.side,snapshot.quantity,snapshot.price,snapshot.executedAt,JSON.stringify(detail)]);
      savedExecutions++;
     } else skippedSnapshots++;
     await conn.query('COMMIT');
     savedOrders++;
    }catch(e){await conn.query('ROLLBACK');throw e;}
   }
   cursor=result.next || undefined;
   if(cursor) { if(cursors.has(cursor))throw new Error('Duplicate pagination cursor');cursors.add(cursor); }
  } while(cursor);
  await conn.query(`UPDATE import_runs SET status='completed',finished_at=now(),scanned_orders=$2,saved_orders=$3,saved_executions=$4 WHERE id=$1`,[runId,scanned,savedOrders,savedExecutions]);
  return {runId,pages,scanned,savedOrders,savedExecutions,skippedSnapshots,status:'completed'};
 }catch(e){
  if(runId){try{await conn.query(`UPDATE import_runs SET status='failed',finished_at=now(),message=$2 WHERE id=$1`,[runId,e instanceof Error? e.message.slice(0,500):'Import error']);}catch{/* log failure without masking initial error */}}
  throw e;
 }finally{
  if(locked) await conn.query('SELECT pg_advisory_unlock(hashtext($1), 740113)',[accountId]);
  conn.release();
 }
}
