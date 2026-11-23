import type {LedgerInput,ClosedMatch} from '@/lib/performance/ledger';
const usd=(n:string|null)=>n===null?'Unverified':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n));
const when=(s:string)=>s.replace('T',' ').slice(0,19);
export function ReviewTotals({gross,net,fees}:{gross:string;net:string|null;fees:string|null}){
 return <div className="performance-metrics">
  <div><small>Gross realized P&amp;L</small><strong>{usd(gross)}</strong></div>
  <div><small>Allocated fees</small><strong>{usd(fees)}</strong></div>
  <div><small>Net realized P&amp;L</small><strong>{usd(net)}</strong></div>
 </div>;
}
export function ReviewMatchTable({matches}:{matches:ClosedMatch[]}){
 return <div className="table-scroll"><table><thead><tr><th>Closed (UTC)</th><th>Ticker</th><th>Direction</th><th>Shares</th><th>Opening execution ID</th><th>Closing execution ID</th><th>Gross P&amp;L</th><th>Net P&amp;L</th></tr></thead><tbody>
 {matches.map((m,i)=><tr key={m.buyId+':'+m.sellId+':'+i}>
  <td>{when(m.closedAt)}</td><td>{m.symbol}</td><td>{m.direction}</td><td>{m.quantity}</td>
  <td>{m.direction==='LONG'?m.buyId:m.sellId}</td><td>{m.direction==='LONG'?m.sellId:m.buyId}</td>
  <td>{usd(m.gross)}</td><td>{usd(m.net)}</td>
 </tr>)}
 </tbody></table></div>;
}
export function ReviewExecutionTable({executions}:{executions:LedgerInput[]}){
 return <div className="table-scroll"><table><thead><tr><th>Filled (UTC)</th><th>Execution ID</th><th>Source</th><th>Ticker</th><th>Side</th><th>Quantity</th><th>Price</th><th>Order fees</th></tr></thead><tbody>
 {executions.map(e=><tr key={e.id}>
  <td>{when(e.executedAt)}</td><td>{e.id}</td><td>{e.id.startsWith('manual:')?'Manual':'Webull snapshot'}</td><td>{e.symbol}</td>
  <td className={e.side==='BUY'?'trade-side-buy':'trade-side-sell'}>{e.side}</td>
  <td>{e.quantity}</td><td>{usd(e.price)}</td><td>{usd(e.fees)}</td>
 </tr>)}
 </tbody></table></div>;
}
