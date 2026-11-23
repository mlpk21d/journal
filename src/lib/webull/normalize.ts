export type Obj = Record<string, unknown>;
export function object(value: unknown): Obj | null { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null; }
export function field(o: Obj, ...keys: string[]): unknown { for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k]; return undefined; }
export function stringField(o: Obj, ...keys: string[]): string | null { const v=field(o,...keys); return typeof v === 'string' || typeof v === 'number' ? String(v) : null; }
export function decimal(value: unknown): string | null {
 if(typeof value !== 'string' && typeof value !== 'number') return null;
 const s=String(value).trim();
 if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return null;
 const n=Number(s); return Number.isFinite(n) && n >= 0 ? s : null;
}
export function timestamp(value: unknown): string | null {
 if(typeof value !== 'string' || !/\d{4}-\d\d-\d\dT/.test(value)) return null;
 const ms=Date.parse(value); return Number.isFinite(ms) ? new Date(ms).toISOString():null;
}
export function orderPages(response: unknown): {orders: Obj[],next: string | null} {
 const outer=object(response);
 if(!outer) throw new Error('Unexpected Webull history response');
 const data=outer.data;
 if(!Array.isArray(data)) throw new Error('Webull history response missing data array');
 const orders=data.map(object);
 if(orders.some(x=>!x)) throw new Error('Unexpected Webull order data');
 const next=stringField(outer,'pagination_key');
 return {orders:orders as Obj[],next:next || null};
}
export type NormalizedOrder = {brokerOrderId:string;clientOrderId:string|null;symbol:string|null;side:string|null;status:string|null;orderedAt:string|null;raw:Obj};
export function normalizeOrder(o:Obj):NormalizedOrder | null {
 const brokerOrderId=stringField(o,'order_id','id');
 const clientOrderId=stringField(o,'client_order_id');
 if(!brokerOrderId && !clientOrderId) return null;
 return {
  brokerOrderId:brokerOrderId ?? 'client:'+clientOrderId,
  clientOrderId, symbol:stringField(o,'symbol'),
  side:stringField(o,'side'),status:stringField(o,'status','order_status'),
  orderedAt:timestamp(field(o,'create_time','created_time','placed_time','place_time','order_time')), raw:o
 };
}
export type Snapshot = {symbol:string;side:'BUY'|'SELL';quantity:string;price:string;executedAt:string};
export function normalizeSnapshot(o:Obj):Snapshot|null {
 const status=stringField(o,'status','order_status')?.toUpperCase();
 if(status !== 'FILLED') return null; // partial fills are not safely reconstructible as a single execution
 const symbol=stringField(o,'symbol');
 const side=stringField(o,'side')?.toUpperCase();
 const quantity=decimal(field(o,'filled_quantity'));
 const price=decimal(field(o,'avg_filled_price','average_filled_price','filled_price'));
 const executedAt=timestamp(field(o,'filled_time','fill_time'));
 if(!symbol || !/^[A-Z0-9.^_-]{1,30}$/i.test(symbol) || (side!=='BUY' && side!=='SELL') || !quantity || Number(quantity)<=0 || !price || !executedAt) return null;
 return {symbol,side,quantity,price,executedAt};
}
export function orderFees(o:Obj): {type:string,amount:string}[] {
 const result: {type:string,amount:string}[]=[];
 const commission=object(o.commission);
 const rawCommission=commission ? field(commission,'actual_commission'):field(o,'actual_commission');
 const commissionValue=decimal(rawCommission);
 if(commissionValue !== null) result.push({type:'COMMISSION',amount:commissionValue});
 if(Array.isArray(o.fees)) {
  const counts=new Map<string,number>();
  for(const item of o.fees) {const f=object(item); if(!f) continue; const type=stringField(f,'type'); const amount=decimal(f.actual_value);
   if(!type || amount===null) continue;
   const count=(counts.get(type)??0)+1;counts.set(type,count);
   result.push({type:count===1 ? type : type+'#'+count,amount});
  }
 }
 return result;
}
