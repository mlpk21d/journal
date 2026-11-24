import { db } from '@/lib/db';
import { webull } from './client';
import { normalizeOrder, normalizeSnapshot, detailOrder, orderFees, orderPages, type Obj } from './normalize';
export type ImportSummary={runId:string;pages:number;scanned:number;savedOrders:number;savedExecutions:number;newExecutions:number;skippedSnapshots:number;status:'completed'};
export type ImportProgress=
 | {stage:'scanning';pages:number;found:number}
 | {stage:'ready';total:number;previouslyImported:number}
 | {stage:'trade';processed:number;total:number;newTrades:number;updatedTrades:number;skipped:number;
    status:'new'|'updated'|'skipped';previouslyImported:boolean;brokerOrderId:string|null;symbol:string|null;side:string|null;
    quantity:string|null;price:string|null;executedAt:string|null}
 | {stage:'complete';summary:ImportSummary};
export type ImportProgressListener=(event:ImportProgress)=>void;
export async function importWebullOrders(accountId:string,start:string,end:string,
 onProgress?:ImportProgressListener):Promise<ImportSummary> {
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
  let pages=0,scanned=0,savedOrders=0,savedExecutions=0,newExecutions=0,skippedSnapshots=0;
  // Fetch all history pages before processing to provide a truthful denominator.
  // The list is already limited to 100 pages by the existing importer.
  const history:Obj[]=[];
  do {
   if(pages>=100)throw new Error('Pagination limit exceeded (100 pages): narrow date range');
   const result=orderPages(await webull.orders(accountId,start,end,cursor));
   history.push(...result.orders);
   pages++;
   onProgress?.({stage:'scanning',pages,found:history.length});
   cursor=result.next || undefined;
   if(cursor){if(cursors.has(cursor))throw new Error('Duplicate pagination cursor');cursors.add(cursor);}
  }while(cursor);
  const total=history.length;
  let previouslyImported=0;
  const originallyKnown=new Set<string>();
  if(onProgress&&total){
   const ids=[...new Set(history.map(item=>normalizeOrder(item)?.brokerOrderId).filter((id):id is string=>!!id))];
   if(ids.length){
    const existing=await conn.query<{broker_order_id:string}>(`SELECT DISTINCT o.broker_order_id
     FROM brokerage_orders o JOIN executions e ON e.brokerage_order_id=o.id
     WHERE o.brokerage_account_id=$1 AND e.source='webull_order_snapshot'
       AND o.broker_order_id=ANY($2::text[])`,[localId,ids]);
    for(const row of existing.rows)originallyKnown.add(row.broker_order_id);
    previouslyImported=history.filter(item=>{
     const order=normalizeOrder(item);
     return order!==null&&originallyKnown.has(order.brokerOrderId);
    }).length;
   }
  }
  onProgress?.({stage:'ready',total,previouslyImported});
  // Each progress event is emitted only after its order transaction commits.
  for(const item of history){
    scanned++;
    const order=normalizeOrder(item);
    if(!order){
     skippedSnapshots++;
     onProgress?.({stage:'trade',processed:scanned,total,newTrades:newExecutions,
      updatedTrades:savedExecutions-newExecutions,skipped:skippedSnapshots,status:'skipped',
      previouslyImported:false,brokerOrderId:null,symbol:null,side:null,quantity:null,price:null,executedAt:null});
     continue;
    }
    let detail:Obj=item;
    if(order.clientOrderId){
     const raw=await webull.orderDetail(accountId,order.clientOrderId);
     detail=detailOrder(raw,item);
    }
    const normalized=normalizeOrder(detail) ?? order;
    await conn.query('BEGIN');
    let snapshotStatus:'new'|'updated'|'skipped'='skipped';
    let snapshotInfo:ReturnType<typeof normalizeSnapshot>=null;
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
     snapshotInfo=snapshot;
     if(snapshot){
      // Distinguish newly created execution snapshots from existing snapshots
      // being refreshed; the account advisory lock serializes this importer.
      const existed=(await conn.query('SELECT 1 FROM executions WHERE brokerage_order_id=$1 AND source=$2 LIMIT 1',[orderId,'webull_order_snapshot'])).rowCount!==0;
      // This record is an order-level weighted average, NOT an exchange-level fill.
      // A dedicated source marker keeps it out of future true execution imports.
      await conn.query(`INSERT INTO executions(brokerage_account_id,brokerage_order_id,source,broker_execution_id,symbol,side,quantity,price,executed_at,raw_payload)
      VALUES($1,$2,'webull_order_snapshot',NULL,$3,$4,$5,$6,$7,$8::jsonb)
      ON CONFLICT(brokerage_order_id) WHERE source='webull_order_snapshot'
      DO UPDATE SET symbol=EXCLUDED.symbol,side=EXCLUDED.side,quantity=EXCLUDED.quantity,price=EXCLUDED.price,
      executed_at=EXCLUDED.executed_at,raw_payload=EXCLUDED.raw_payload`,[localId,orderId,snapshot.symbol,snapshot.side,snapshot.quantity,snapshot.price,snapshot.executedAt,JSON.stringify(detail)]);
      savedExecutions++;
      if(!existed)newExecutions++;
      snapshotStatus=existed?'updated':'new';
     } else {
      // If an order was corrected or cancelled, remove an earlier stale snapshot.
      await conn.query("DELETE FROM executions WHERE brokerage_order_id=$1 AND source='webull_order_snapshot'",[orderId]);
      skippedSnapshots++;
     }
     await conn.query('COMMIT');
     savedOrders++;
     onProgress?.({stage:'trade',processed:scanned,total,newTrades:newExecutions,
      updatedTrades:savedExecutions-newExecutions,skipped:skippedSnapshots,
      status:snapshotStatus,previouslyImported:originallyKnown.has(order.brokerOrderId),
      brokerOrderId:order.brokerOrderId,
      symbol:snapshotInfo?.symbol??normalized.symbol,side:snapshotInfo?.side??normalized.side,
      quantity:snapshotInfo?.quantity??null,price:snapshotInfo?.price??null,
      executedAt:snapshotInfo?.executedAt??null});
    }catch(e){await conn.query('ROLLBACK');throw e;}
  }
  await conn.query(`UPDATE import_runs SET status='completed',finished_at=now(),scanned_orders=$2,saved_orders=$3,saved_executions=$4 WHERE id=$1`,[runId,scanned,savedOrders,savedExecutions]);
  const summary:ImportSummary={runId,pages,scanned,savedOrders,savedExecutions,newExecutions,skippedSnapshots,status:'completed'};
  onProgress?.({stage:'complete',summary});
  return summary;
 }catch(e){
  if(runId){try{await conn.query(`UPDATE import_runs SET status='failed',finished_at=now(),message=$2 WHERE id=$1`,[runId,e instanceof Error? e.message.slice(0,500):'Import error']);}catch{/* log failure without masking initial error */}}
  throw e;
 }finally{
  if(locked) await conn.query('SELECT pg_advisory_unlock(hashtext($1), 740113)',[accountId]);
  conn.release();
 }
}
