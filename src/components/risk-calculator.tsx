'use client';
import Link from 'next/link';
import {useEffect,useState,type FormEvent} from 'react';
import {loadRiskInputs} from '@/features/risk-management/actions';
import {positionSize,quickPositionSize} from '@/lib/risk/position-size';
type Data=Extract<Awaited<ReturnType<typeof loadRiskInputs>>,{ok:true}>['data'];
const money=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
const stamp=(n:number|null)=>n===null?'Unknown':new Date(n).toLocaleString('en-US',{timeZone:'America/New_York'})+' ET';
export function RiskCalculator({accountId,label}:{accountId:string;label:string}){
 const [symbol,setSymbol]=useState(''),[category,setCategory]=useState<'US_STOCK'|'US_ETF'>('US_STOCK');
 const [risk,setRisk]=useState('0.25'),[direction,setDirection]=useState<'LONG'|'SHORT'>('LONG');
 const [stop,setStop]=useState(''),[slippage,setSlippage]=useState('0.02'),[fees,setFees]=useState('0');
 const [data,setData]=useState<Data|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [feedback,setFeedback]=useState('');
 const [refreshStarted,setRefreshStarted]=useState(0);
 const [refreshFailed,setRefreshFailed]=useState(false);
 const [now,setNow]=useState(0),[entry,setEntry]=useState('');
 const [ready,setReady]=useState(false);
 const [marginRatio,setMarginRatio]=useState<1|2>(2);
 const [move,setMove]=useState('0.50');
 const [riskMode,setRiskMode]=useState<'percent'|'dollars'>('percent');
 const [dollars,setDollars]=useState('50');
 const key='journal-risk-percent:'+accountId;
 useEffect(()=>{try{const saved=localStorage.getItem(key);if(saved&&Number(saved)>0&&Number(saved)<=100)setRisk(saved);const m=localStorage.getItem(key+':move');if(m&&Number(m)>0&&Number(m)<100)setMove(m);const mode=localStorage.getItem(key+':mode');if(mode==='dollars'||mode==='percent')setRiskMode(mode);const d=localStorage.getItem(key+':dollars');if(d&&Number.isFinite(Number(d))&&Number(d)>0)setDollars(d);}catch{}setReady(true);},[key]);
 useEffect(()=>{if(ready&&Number(risk)>0&&Number(risk)<=100)try{localStorage.setItem(key,risk);}catch{}},[ready,key,risk]);
 useEffect(()=>{if(ready&&Number(move)>0&&Number(move)<100)try{localStorage.setItem(key+':move',move);}catch{}},[ready,key,move]);
 useEffect(()=>{if(ready)try{localStorage.setItem(key+':mode',riskMode);if(Number.isFinite(Number(dollars))&&Number(dollars)>0)localStorage.setItem(key+':dollars',dollars);}catch{}},[ready,key,riskMode,dollars]);
 useEffect(()=>{const tick=()=>setNow(Date.now());tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[]);
 async function lookup(e:FormEvent){
  e.preventDefault();if(busy)return;
  setBusy(true);setError('');setFeedback('');setRefreshFailed(false);const started=Date.now();setRefreshStarted(started);setNow(started);
  try{const r=await loadRiskInputs(symbol.trim().toUpperCase(),category,accountId);
   if(r.ok){const completed=Date.now();const cached=data&&data.quoteFetchedAt===r.data.quoteFetchedAt&&data.balanceFetchedAt===r.data.balanceFetchedAt;setData(r.data);setEntry(previous=>!data||previous===String(data.price)?String(r.data.price):previous);setNow(completed);setFeedback((cached?'Refresh completed using recent cached data':'Quote and balance refreshed')+' at '+stamp(completed)+'.');}
   else {setError(r.error);setRefreshFailed(true);}
  }catch{setError('Lookup failed. Refresh and try again.');setRefreshFailed(true);}finally{setBusy(false);}
 }
 const stale=!!data&&(busy||refreshFailed||data.quoteTime===null||now-data.quoteTime>60000||now-data.balanceFetchedAt>60000);
 const riskInput=riskMode==='dollars'?{riskDollars:Number(dollars)}:{riskPercent:Number(risk)};
 const riskFilled=(riskMode==='dollars'?dollars:risk).trim();
 const quick=data&&riskFilled&&move.trim()&&slippage.trim()&&fees.trim()?quickPositionSize({equity:data.equity,buyingPower:data.buyingPower,marginRatio,entry:data.price,...riskInput,movePercent:Number(move),slippage:Number(slippage),fees:Number(fees),direction}):null;
 const size=data&&stop.trim()&&entry.trim()&&riskFilled&&slippage.trim()&&fees.trim()?positionSize({equity:data.equity,buyingPower:data.buyingPower,marginRatio,entry:Number(entry),stop:Number(stop),...riskInput,slippage:Number(slippage),fees:Number(fees),direction}):null;
 return <section className="rm-calculator">
 <div className="rm-title-row">
 <section className="page-title"><p className="eyebrow">TRADE MANAGEMENT / PRE-TRADE</p><h1>Risk Management</h1><p className="intro">Size a trade using Webull account equity, an FMP market snapshot and your technical stop.</p></section>
 <div className="analytics-metrics rm-header-metrics" aria-label="Account and quote summary">
 <div><small>Account equity</small><strong>{data?money(data.equity):'—'}</strong>{data&&<small>Fetched {stamp(data.balanceFetchedAt)}</small>}</div>
 <div><small>Buying power</small><strong>{data&&data.buyingPower!==null?money(data.buyingPower):'—'}</strong></div>
 <div><small>{data?data.symbol+' price (FMP)':'Ticker price (FMP)'}</small><strong>{data?money(data.price):'—'}</strong>{data&&<small>Trade {stamp(data.quoteTime)} · fetched {stamp(data.quoteFetchedAt)}</small>}</div>
 </div></div>
 <nav className="pill-row"><Link href="/risk">Risk &amp; Trade Quality ↗</Link></nav>
 <p className="helper">Account: <strong>{label}</strong> (sidebar selection)</p>
 <form className="performance-filter rm-fields" onSubmit={lookup}>
 <div className="rm-field"><label htmlFor="rm-symbol">Ticker</label><input id="rm-symbol" required maxLength={15} placeholder="NVDA" value={symbol} disabled={busy} onChange={e=>{setSymbol(e.target.value.toUpperCase());setData(null);setEntry('');setStop('');setFeedback('');setError('');setRefreshFailed(false);}}/></div>
 <div className="rm-field"><label htmlFor="rm-category">Asset</label><select id="rm-category" value={category} disabled={busy} onChange={e=>{setCategory(e.target.value as typeof category);setData(null);setStop('');setEntry('');setFeedback('');setError('');setRefreshFailed(false);}}><option value="US_STOCK">Stock</option><option value="US_ETF">ETF</option></select></div>
 <div className="rm-field"><label htmlFor="rm-margin">Margin ratio</label><select id="rm-margin" value={marginRatio} onChange={e=>setMarginRatio(e.target.value==='1'?1:2)}><option value={2}>2:1</option><option value={1}>1:1</option></select></div>
 <div className="rm-field rm-refresh"><button disabled={busy} type="submit" aria-busy={busy}>{busy?'Loading FMP & Webull…':data?'Refresh quote & balance':'Get quote & balance'}</button></div>
 </form>
 <div className="rm-refresh-status" aria-live="polite" aria-atomic="true">
 {busy?<div className="rm-status rm-status-loading" role="status"><span className="rm-spinner" aria-hidden="true"/> <span>Refreshing FMP quote and Webull balance… {Math.max(0,Math.floor((now-refreshStarted)/1000))}s elapsed. {now-refreshStarted>10000?'Webull may be queued or cooling down due to rate limits.':''}</span></div>:error?<div className="rm-status rm-status-error" role="alert">{error}{data?' Previous values retained for reference only.':''}</div>:feedback?<div className="rm-status rm-status-success" role="status">{feedback}</div>:<p className="helper">Enter a ticker and retrieve the latest available quote and account balance.</p>}
 </div>
 {stale&&<p role="status" className="notice">{busy?'Refresh in progress. Previous values are illustrative only.':refreshFailed?'Refresh failed. Previous values are illustrative only.':'Quote or balance is older than 60 seconds, or the trade timestamp is missing. Refresh and verify in Webull before trading. Results below are illustrative only.'}</p>}
 <h2>Quick Position Size</h2>
 <div className="performance-filter rm-fields">
 <div className="rm-field"><label htmlFor="rm-quick-risk-mode">Risk per trade</label><select id="rm-quick-risk-mode" value={riskMode} onChange={e=>setRiskMode(e.target.value as typeof riskMode)}><option value="dollars">Dollar amount ($)</option><option value="percent">Account percentage (%)</option></select></div>
 <div className="rm-field"><label htmlFor="rm-quick-risk">{riskMode==='dollars'?'Risk amount ($)':'Account risk (%)'}</label><input id="rm-quick-risk" type="number" min="0.01" max={riskMode==='percent'?100:undefined} step="0.01" value={riskMode==='dollars'?dollars:risk} onChange={e=>riskMode==='dollars'?setDollars(e.target.value):setRisk(e.target.value)}/></div>
 <div className="rm-field"><label htmlFor="rm-move">Assumed adverse move (%)</label><input id="rm-move" type="number" min="0.01" max="99.99" step="0.01" value={move} onChange={e=>setMove(e.target.value)}/></div>
 </div>
 {quick&&data?<div className="analytics-metrics">
 <div><small>{stale?'Stale quote · illustrative shares':'Estimated whole shares'}</small><strong style={{fontSize:'2rem'}}>{quick.shares.toLocaleString()}</strong></div>
 <div><small>Dollar risk budget</small><strong>{money(quick.budget)}</strong></div>
 <div><small>Assumed adverse move/share</small><strong>{money(quick.distance)}</strong></div>
 <div><small>Estimated position value</small><strong>{money(quick.notional)}</strong></div>
 <div><small>Estimated loss incl. costs</small><strong>{money(quick.estimatedLoss)}</strong></div>
 </div>:<p className="helper">{data?'Enter valid risk, adverse move and cost assumptions.':'Retrieve a ticker quote and account balance to see the estimate immediately.'}</p>}
 <p className="notice">Quick sizing uses the quoted price, assumed adverse move, slippage and fees below, and the selected margin ratio plus buying power when available. It does not require or place a stop. Actual risk is unknown until a technical stop and execution price are established. Use the precise calculator below before placing a trade.</p>
 <h2>Precise Position Sizing (optional stop-loss)</h2>
 <div className="performance-filter rm-fields">
 <div className="rm-field"><label htmlFor="rm-risk-mode">Risk per trade</label><select id="rm-risk-mode" value={riskMode} onChange={e=>setRiskMode(e.target.value as typeof riskMode)}><option value="dollars">Dollar amount ($)</option><option value="percent">Account percentage (%)</option></select></div>
 <div className="rm-field"><label htmlFor="rm-risk">{riskMode==='dollars'?'Risk amount ($)':'Account risk (%)'}</label><input id="rm-risk" type="number" min="0.01" max={riskMode==='percent'?100:undefined} step="0.01" value={riskMode==='dollars'?dollars:risk} onChange={e=>riskMode==='dollars'?setDollars(e.target.value):setRisk(e.target.value)}/></div>
 <div className="rm-field"><label htmlFor="rm-dir">Direction</label><select id="rm-dir" value={direction} onChange={e=>{setDirection(e.target.value as typeof direction);setStop('');}}><option>LONG</option><option>SHORT</option></select></div>
 <div className="rm-field"><label htmlFor="rm-entry">Planned entry ($)</label><input id="rm-entry" type="number" min="0.0001" step="any" value={entry} onChange={e=>setEntry(e.target.value)}/></div>
 <div className="rm-field"><label htmlFor="rm-stop">Stop-loss ($)</label><input id="rm-stop" type="number" min="0.0001" step="any" value={stop} onChange={e=>setStop(e.target.value)} placeholder="Technical stop"/></div>
 <div className="rm-field"><label htmlFor="rm-slip">Slippage/share ($)</label><input id="rm-slip" type="number" min="0" step="any" value={slippage} onChange={e=>setSlippage(e.target.value)}/></div>
 <div className="rm-field"><label htmlFor="rm-fees">Estimated round-trip fees ($)</label><input id="rm-fees" type="number" min="0" step="any" value={fees} onChange={e=>setFees(e.target.value)}/></div>
 </div>
 {data&&!size&&<p className="helper">Enter a positive risk budget no greater than account equity, valid costs, and a stop below the long entry or above the short entry.</p>}
 {size&&<div className="analytics-metrics">
 <div><small>{stale?'Illustrative share count':'Calculated whole shares'}</small><strong>{size.shares.toLocaleString()}</strong></div>
 <div><small>Dollar risk budget</small><strong>{money(size.budget)}</strong></div>
 <div><small>Stop distance/share</small><strong>{money(size.distance)}</strong></div>
 <div><small>Risk-only shares</small><strong>{size.riskShares.toLocaleString()}</strong></div>
 <div><small>Estimated position value</small><strong>{money(size.notional)}</strong></div>
 <div><small>Estimated loss incl. costs</small><strong>{money(size.estimatedLoss)}</strong></div>
 </div>}
 <p className="notice">Risk mode, dollar amount, account risk % and assumed adverse move % are saved per account in this browser. FMP quotes are snapshots, not executable bid/ask prices; latency depends on your subscription. Extended-hours quotes are not explicitly requested. Margin ratio is a per-trade assumption (defaults to 2:1); estimated exposure is capped at equity × ratio and Webull buying power when available. This is not a guarantee of stock-specific margin or short availability. Verify actual entry, buying power, short locates and stop in Webull. Stops can slip or gap; losses can exceed estimates. No orders are placed.</p>
 </section>;
}
