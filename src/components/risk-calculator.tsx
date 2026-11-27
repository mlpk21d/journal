'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {loadRiskInputs} from '@/features/risk-management/actions';
import {positionSize} from '@/lib/risk/position-size';
type Data=Extract<Awaited<ReturnType<typeof loadRiskInputs>>,{ok:true}>['data'];
const money=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
const stamp=(n:number|null)=>n===null?'Unknown':new Date(n).toLocaleString('en-US',{timeZone:'America/New_York'})+' ET';
export function RiskCalculator({accountId,label}:{accountId:string;label:string}){
 const [symbol,setSymbol]=useState(''),[category,setCategory]=useState<'US_STOCK'|'US_ETF'>('US_STOCK');
 const [risk,setRisk]=useState('0.25'),[direction,setDirection]=useState<'LONG'|'SHORT'>('LONG');
 const [stop,setStop]=useState(''),[slippage,setSlippage]=useState('0.02'),[fees,setFees]=useState('0');
 const [data,setData]=useState<Data|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [now,setNow]=useState(0),[entry,setEntry]=useState('');
 const [ready,setReady]=useState(false);
 const key='journal-risk-percent:'+accountId;
 useEffect(()=>{try{const saved=localStorage.getItem(key);if(saved&&Number(saved)>0&&Number(saved)<=100)setRisk(saved);}catch{}setReady(true);},[key]);
 useEffect(()=>{if(ready&&Number(risk)>0&&Number(risk)<=100)try{localStorage.setItem(key,risk);}catch{}},[ready,key,risk]);
 useEffect(()=>{const tick=()=>setNow(Date.now());tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[]);
 async function lookup(e:FormEvent){
  e.preventDefault();if(busy)return;
  setBusy(true);setError('');setData(null);setEntry('');
  try{const r=await loadRiskInputs(symbol.trim().toUpperCase(),category,accountId);
   if(r.ok){setData(r.data);setEntry(String(r.data.price));setNow(Date.now());}
   else setError(r.error);
  }catch{setError('Lookup failed. Refresh and try again.');}finally{setBusy(false);}
 }
 const stale=!!data&&(data.quoteTime===null||now-data.quoteTime>60000||now-data.balanceFetchedAt>60000);
 const size=data&&stop.trim()&&entry.trim()&&risk.trim()&&slippage.trim()&&fees.trim()?positionSize({equity:data.equity,buyingPower:data.buyingPower,entry:Number(entry),stop:Number(stop),riskPercent:Number(risk),slippage:Number(slippage),fees:Number(fees),direction}):null;
 return <section>
 <p className="helper">Account: <strong>{label}</strong> (sidebar selection)</p>
 <form className="performance-filter" onSubmit={lookup}>
 <label htmlFor="rm-symbol">Ticker</label><input id="rm-symbol" required maxLength={15} placeholder="NVDA" value={symbol} disabled={busy} onChange={e=>{setSymbol(e.target.value.toUpperCase());setData(null);setEntry('');setStop('');}}/>
 <label htmlFor="rm-category">Asset</label><select id="rm-category" value={category} disabled={busy} onChange={e=>{setCategory(e.target.value as typeof category);setData(null);setStop('');setEntry('');}}><option value="US_STOCK">Stock</option><option value="US_ETF">ETF</option></select>
 <button disabled={busy} type="submit">{busy?'Loading Webull…':data?'Refresh quote & balance':'Get quote & balance'}</button>
 </form>
 {error&&<p role="alert" className="notice">{error}</p>}
 {data&&<><div className="analytics-metrics">
 <div><small>Account equity (net liquidation)</small><strong>{money(data.equity)}</strong><small>Fetched {stamp(data.balanceFetchedAt)}</small></div>
 <div><small>Buying power</small><strong>{data.buyingPower===null?'Unavailable':money(data.buyingPower)}</strong></div>
 <div><small>{data.symbol} last traded price</small><strong>{money(data.price)}</strong><small>Trade {stamp(data.quoteTime)} · fetched {stamp(data.quoteFetchedAt)}</small></div>
 </div>{stale&&<p role="status" className="notice">Quote or balance is older than 60 seconds, or the trade timestamp is missing. Refresh and verify in Webull before trading. Results below are illustrative only.</p>}</>}
 <h2>Position sizing</h2>
 <div className="performance-filter">
 <label htmlFor="rm-risk">Account risk %</label><input id="rm-risk" type="number" min="0.01" max="100" step="0.01" value={risk} onChange={e=>setRisk(e.target.value)}/>
 <label htmlFor="rm-dir">Direction</label><select id="rm-dir" value={direction} onChange={e=>{setDirection(e.target.value as typeof direction);setStop('');}}><option>LONG</option><option>SHORT</option></select>
 <label htmlFor="rm-entry">Planned entry ($)</label><input id="rm-entry" type="number" min="0.0001" step="any" value={entry} onChange={e=>setEntry(e.target.value)}/>
 <label htmlFor="rm-stop">Stop-loss ($)</label><input id="rm-stop" type="number" min="0.0001" step="any" value={stop} onChange={e=>setStop(e.target.value)} placeholder="Technical stop"/>
 <label htmlFor="rm-slip">Slippage/share ($)</label><input id="rm-slip" type="number" min="0" step="any" value={slippage} onChange={e=>setSlippage(e.target.value)}/>
 <label htmlFor="rm-fees">Estimated round-trip fees ($)</label><input id="rm-fees" type="number" min="0" step="any" value={fees} onChange={e=>setFees(e.target.value)}/>
 </div>
 {data&&!size&&<p className="helper">Enter valid risk and cost inputs and a stop below the long entry or above the short entry.</p>}
 {size&&<div className="analytics-metrics">
 <div><small>{stale?'Illustrative share count':'Calculated whole shares'}</small><strong>{size.shares.toLocaleString()}</strong></div>
 <div><small>Dollar risk budget</small><strong>{money(size.budget)}</strong></div>
 <div><small>Stop distance/share</small><strong>{money(size.distance)}</strong></div>
 <div><small>Risk-only shares</small><strong>{size.riskShares.toLocaleString()}</strong></div>
 <div><small>Estimated position value</small><strong>{money(size.notional)}</strong></div>
 <div><small>Estimated loss incl. costs</small><strong>{money(size.estimatedLoss)}</strong></div>
 </div>}
 <p className="notice">Risk % is saved per account in this browser. Quotes are regular-session snapshots, not executable bid/ask prices. Buying power is a conservative notional cap when available, not proof of margin or short availability. Verify actual entry, buying power, short locates and stop in Webull. Stops can slip or gap; losses can exceed estimates. No orders are placed.</p>
 </section>;
}
