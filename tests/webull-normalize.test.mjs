import test from 'node:test';
import assert from 'node:assert/strict';
import { orderPages, normalizeOrder, normalizeSnapshot, detailOrder, orderFees } from '../src/lib/webull/normalize.ts';

const history={
 data:[{client_order_id:'GROUP-1', orders:[
  {client_order_id:'CLIENT-1',order_id:'ORDER-1',symbol:'AAPL',side:'BUY',status:'FILLED',
   filled_quantity:'2',filled_price:'190.25',filled_time_at:'2026-11-20T15:30:01.123Z',place_time_at:'2026-11-20T15:29:00.123Z'},
  {client_order_id:'CLIENT-2',order_id:'ORDER-2',symbol:'MSFT',side:'SELL',status:'CANCELED'}
 ]}],
 pagination_key:'CURSOR'
};
test('history groups flatten into individual orders and preserve the cursor',()=>{
 const page=orderPages(history);
 assert.equal(page.orders.length,2);
 assert.equal(page.next,'CURSOR');
 assert.equal(normalizeOrder(page.orders[0])?.brokerOrderId,'ORDER-1');
 assert.equal(normalizeOrder(page.orders[1])?.brokerOrderId,'ORDER-2');
 assert.equal(page.orders[0]._history_group,history.data[0]);
});
test('completed orders have validated weighted average snapshots',()=>{
 assert.deepEqual(normalizeSnapshot(orderPages(history).orders[0]), {
  symbol:'AAPL',side:'BUY',quantity:'2',price:'190.25',executedAt:'2026-11-20T15:30:01.123Z'
 });
 assert.equal(normalizeSnapshot(orderPages(history).orders[1]),null);
 assert.equal(normalizeSnapshot({symbol:'AAPL',side:'BUY',status:'FILLED',filled_quantity:'2',filled_price:'190'}),null);
});
test('detail resolution matches order_id, not an ambiguous group identifier',()=>{
 const data={data:{orders:[
  {order_id:'ORDER-2',client_order_id:'GROUP-1',status:'CANCELED'},
  {order_id:'ORDER-1',client_order_id:'GROUP-1',status:'FILLED'}
 ]}};
 assert.equal(detailOrder(data,history.data[0].orders[0]).order_id,'ORDER-1');
 assert.throws(()=>detailOrder({data:{orders:[]}},history.data[0].orders[0]));
});
test('fees prefer actual settled values and retain types',()=>{
 assert.deepEqual(orderFees({commission:{actual_commission:'0.02'},fees:[
  {type:'REGULATORY',actual_value:'0.03'},
  {type:'REGULATORY',actual_value:'0.01'}
 ]}),[{type:'COMMISSION',amount:'0.02'},{type:'REGULATORY',amount:'0.03'},{type:'REGULATORY#2',amount:'0.01'}]);
});
