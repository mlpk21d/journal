'use client';
import Link from 'next/link';
import {useEffect,useState,type FormEvent} from 'react';
import {loadRiskInputs} from '@/features/risk-management/actions';
import {positionSize,atrPositionSize,MARGIN_RATIOS,type MarginRatio} from '@/lib/risk/position-size';
import {ATR_MULTIPLIER} from '@/lib/risk/intraday-atr';
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
 const [marginRatio,setMarginRatio]=useState<MarginRatio>(2);
 const [sizingTab,setSizingTab]=useState<'quick'|'precise'>('quick');
 const [manualAtr,setManualAtr]=useState('');
 const [multiplier,setMultiplier]=useState(String(ATR_MULTIPLIER));
 const [riskMode,setRiskMode]=useState<'percent'|'dollars'>('percent');
 const [dollars,setDollars]=useState('50');
 const key='journal-risk-percent:'+accountId;
 useEffect(()=>{try{const saved=localStorage.getItem(key);if(saved&&Number(saved)>0&&Number(saved)<=100)setRisk(saved);const m=localStorage.getItem(key+':atr-multiplier');if(m&&Number.isFinite(Number(m))&&Number(m)>0)setMultiplier(m);const mode=localStorage.getItem(key+':mode');if(mode==='dollars'||mode==='percent')setRiskMode(mode);const d=localStorage.getItem(key+':dollars');if(d&&Number.isFinite(Number(d))&&Number(d)>0)setDollars(d);}catch{}setReady(true);},[key]);
 useEffect(()=>{if(ready&&Number(risk)>0&&Number(risk)<=100)try{localStorage.setItem(key,risk);}catch{}},[ready,key,risk]);
 useEffect(()=>{if(ready&&Number.isFinite(Number(multiplier))&&Number(multiplier)>0)try{localStorage.setItem(key+':atr-multiplier',multiplier);}catch{}},[ready,key,multiplier]);
 useEffect(()=>{if(ready)try{localStorage.setItem(key+':mode',riskMode);if(Number.isFinite(Number(dollars))&&Number(dollars)>0)localStorage.setItem(key+':dollars',dollars);}catch{}},[ready,key,riskMode,dollars]);
 useEffect(()=>{const tick=()=>setNow(Date.now());tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[]);
 async function lookup(e:FormEvent){
  e.preventDefault();if(busy)return;
  setBusy(true);setError('');setFeedback('');setRefreshFailed(false);const started=Date.now();setRefreshStarted(started);setNow(started);
  try{const r=await loadRiskInputs(symbol.trim().toUpperCase(),category,accountId);
   if(r.ok){const completed=Date.now();const cached=data&&data.quoteFetchedAt===r.data.quoteFetchedAt&&data.balanceFetchedAt===r.data.balanceFetchedAt;setData(r.data);setEntry(previous=>!data||previous===String(data.price)?String(r.data.price):previous);setNow(completed);setFeedback((cached?'Refresh completed using recent cached data':'Quote, ATR and balance refreshed')+' at '+stamp(completed)+'.');}
   else {setError(r.error);setRefreshFailed(true);}
  }catch{setError('Lookup failed. Refresh and try again.');setRefreshFailed(true);}finally{setBusy(false);}
 }
 const stale=!!data&&(busy||refreshFailed||data.quoteTime===null||now-data.quoteTime>60000||now-data.balanceFetchedAt>60000);
 const riskInput=riskMode==='dollars'?{riskDollars:Number(dollars)}:{riskPercent:Number(risk)};
 const riskFilled=(riskMode==='dollars'?dollars:risk).trim();
 const atrStale=!!data?.atr&&now-data.atr.barClosedAt>15*60000;
 const quick=data?.atr&&riskFilled&&slippage.trim()&&fees.trim()?atrPositionSize({equity:data.equity,buyingPower:data.buyingPower,marginRatio,entry:data.price,...riskInput,atr:data.atr.value,multiplier:ATR_MULTIPLIER,slippage:Number(slippage),fees:Number(fees),direction}):null;
 const preciseInputs=data&&entry.trim()&&riskFilled&&slippage.trim()&&fees.trim()?{equity:data.equity,buyingPower:data.buyingPower,marginRatio,entry:Number(entry),...riskInput,slippage:Number(slippage),fees:Number(fees),direction}:null;
 const effectiveAtr=manualAtr.trim()?Number(manualAtr):data?.atr?.value??NaN;
 const size=preciseInputs?(stop.trim()?positionSize({...preciseInputs,stop:Number(stop)}):atrPositionSize({...preciseInputs,atr:effectiveAtr,multiplier:Number(multiplier)})):null;
 const activeSize=sizingTab==='quick'?quick:size;
 const activeStale=stale||(sizingTab==='quick'?atrStale:!stop.trim()&&!manualAtr.trim()&&atrStale);
 return <section className="rm-calculator">
 <div className="rm-title-row">
 <section className="page-title"><p className="eyebrow">TRADE MANAGEMENT / PRE-TRADE</p><h1>Risk Management</h1><p className="intro">Size a trade using Webull account equity, an FMP market snapshot and your technical stop.</p></section>
 <div className="analytics-metrics rm-header-metrics" aria-label="Account and quote summary">
 <div><small>Account equity</small><strong>{data?money(data.equity):'—'}</strong>{data&&<small>Fetched {stamp(data.balanceFetchedAt)}</small>}</div>
 <div><small>Buying power</small><strong>{data&&data.buyingPower!==null?money(data.buyingPower):'—'}</strong></div>
 <div><small>{data?data.symbol+' price (FMP)':'Ticker price (FMP)'}</small><strong>{data?money(data.price):'—'}</strong>{data&&<small>Trade {stamp(data.quoteTime)} · fetched {stamp(data.quoteFetchedAt)}</small>}</div>
 </div></div>
 <nav className="pill-row"><Link href="/risk">Risk &amp; Trade Quality ↗</Link></nav>
 <div className="rm-workspace">
 <aside className="rm-card rm-market-panel" aria-label="Market and account inputs">
 <div className="rm-card-heading"><h2>Trade setup</h2></div>
 <p className="helper">Account: <strong>{label}</strong> (sidebar selection)</p>
 <form className="performance-filter rm-fields rm-market-fields" onSubmit={lookup}>
 <div className="rm-field"><label htmlFor="rm-symbol">Ticker</label><input id="rm-symbol" required maxLength={15} placeholder="NVDA" value={symbol} disabled={busy} onChange={e=>{setSymbol(e.target.value.toUpperCase());setData(null);setManualAtr('');setEntry('');setStop('');setFeedback('');setError('');setRefreshFailed(false);}}/></div>
 <div className="rm-field"><label htmlFor="rm-category">Asset</label><select id="rm-category" value={category} disabled={busy} onChange={e=>{setCategory(e.target.value as typeof category);setData(null);setManualAtr('');setStop('');setEntry('');setFeedback('');setError('');setRefreshFailed(false);}}><option value="US_STOCK">Stock</option><option value="US_ETF">ETF</option></select></div>
 <div className="rm-risk-tabs"><p className="rm-card-note">Risk per trade</p><div className="rm-tabs" role="group" aria-label="Risk mode">
 <button type="button" aria-pressed={riskMode==='dollars'} onClick={()=>setRiskMode('dollars')}>Dollar amount ($)</button>
 <button type="button" aria-pressed={riskMode==='percent'} onClick={()=>setRiskMode('percent')}>Account Percentage (%)</button>
 </div>
 <div className="rm-field"><label htmlFor="rm-shared-risk">{riskMode==='dollars'?'Risk amount ($)':'Account risk (%)'}</label><input id="rm-shared-risk" type="number" min="0.01" max={riskMode==='percent'?100:undefined} step="0.01" value={riskMode==='dollars'?dollars:risk} onChange={e=>riskMode==='dollars'?setDollars(e.target.value):setRisk(e.target.value)}/></div>
 </div>
 <div className="rm-field"><label htmlFor="rm-margin">Margin ratio</label><select id="rm-margin" value={marginRatio} onChange={e=>setMarginRatio(Number(e.target.value) as MarginRatio)}>{MARGIN_RATIOS.map(r=><option key={r} value={r}>{r}:1</option>)}</select></div>
 <div className="rm-field rm-refresh"><button disabled={busy} type="submit" aria-busy={busy}>{busy?'Loading FMP & Webull…':data?'Refresh quote, ATR & balance':'Get quote, ATR & balance'}</button></div>
 </form>
 <div className="rm-refresh-status" aria-live="polite" aria-atomic="true">
 {busy?<div className="rm-status rm-status-loading" role="status"><span className="rm-spinner" aria-hidden="true"/> <span>Refreshing FMP quote, ATR and Webull balance… {Math.max(0,Math.floor((now-refreshStarted)/1000))}s elapsed. {now-refreshStarted>10000?'Webull may be queued or cooling down due to rate limits.':''}</span></div>:error?<div className="rm-status rm-status-error" role="alert">{error}{data?' Previous values retained for reference only.':''}</div>:feedback?<div className="rm-status rm-status-success" role="status">{feedback}</div>:<p className="helper">Enter a ticker and retrieve the latest available quote and account balance.</p>}
 </div>
 {stale&&<p role="status" className="notice">{busy?'Refresh in progress. Previous values are illustrative only.':refreshFailed?'Refresh failed. Previous values are illustrative only.':'Quote or balance is older than 60 seconds, or the trade timestamp is missing. Refresh and verify in Webull before trading. Results below are illustrative only.'}</p>}
 </aside>
 <div className="rm-sizing-column">
 <section className="rm-card rm-summary-panel" aria-labelledby="rm-summary-title" aria-live="polite">
 <div className="rm-card-heading"><h2 id="rm-summary-title">Position Summary</h2><span className="rm-card-tag">{sizingTab==='quick'?'Quick · Automatic ATR':'Precise · '+(stop.trim()?'Manual stop':'ATR')}</span></div>
 <div className="rm-result rm-summary-result">
 <span className="rm-result-label">{activeStale?'Illustrative share count':'Calculated position size'}</span>
 <strong className="rm-share-count">{activeSize?activeSize.shares.toLocaleString()+' shares':'—'}</strong>
 <div className="rm-result-metrics rm-summary-metrics">
 <div><small>Risk budget</small><strong>{activeSize?money(activeSize.budget):'—'}</strong></div>
 <div><small>{sizingTab==='quick'?'Assumed stop distance':'Stop distance/share'}</small><strong>{activeSize?'
 <div className="rm-tabs" role="group" aria-label="Position sizing mode">
 <button type="button" aria-pressed={sizingTab==='quick'} onClick={()=>setSizingTab('quick')}>Quick Position Size</button>
 <button type="button" aria-pressed={sizingTab==='precise'} onClick={()=>setSizingTab('precise')}>Precise Position Sizing</button>
 </div>
 <section className="rm-tab-panel" hidden={sizingTab!=='quick'} aria-labelledby="rm-quick-title">
 <div className="rm-card-heading"><h2 id="rm-quick-title">Quick Position Size</h2><span className="rm-card-tag">Automatic ATR</span></div>
 <p className="rm-card-description">Volatility-adjusted share count from the latest FMP quote. No stop entry required.</p>
 <div className="rm-card-fields">
 <div className="rm-field"><label>Current stock price</label><div className="rm-readonly">{data?money(data.price):'—'}</div></div>
 <div className="rm-field"><label>5-minute ATR(14) · FMP</label><div className="rm-readonly">{data?.atr?'$'+data.atr.value.toFixed(4):'—'}</div></div>
 <div className="rm-field"><label>ATR multiplier</label><div className="rm-readonly">{ATR_MULTIPLIER.toFixed(1)}×</div></div>
 </div>
 <p className="rm-card-note">{data?.atr?'Last closed bar: '+stamp(data.atr.barClosedAt):'ATR is retrieved automatically with the quote.'}</p>
 {!quick&&<p className="rm-card-note">{data?(data.atr?'Enter valid risk and cost assumptions.':'FMP ATR unavailable. Use a manual stop or ATR override in the precise calculator.'):'Retrieve a ticker quote and account balance to calculate shares.'}</p>}
 {atrStale&&<p className="rm-card-note rm-warning">ATR is from an older session or delayed feed. Verify the timestamp.</p>}
 <p className="rm-card-note rm-card-footer">Uses 1.5× automatic ATR, shared risk and cost settings, margin ratio and available buying power. This is an estimate, not a technical stop.</p>
 </section>
 <section className="rm-tab-panel" hidden={sizingTab!=='precise'} aria-labelledby="rm-precise-title">
 <div className="rm-card-heading"><h2 id="rm-precise-title">Precise Position Sizing</h2><span className="rm-card-tag">Editable</span></div>
 <p className="rm-card-description">Adjust the ATR or enter your technical stop to calculate a trade-specific share count.</p>
 <div className="rm-card-fields">
 <div className="rm-field"><label htmlFor="rm-entry">Planned entry ($)</label><input id="rm-entry" type="number" min="0.0001" step="any" value={entry} onChange={e=>setEntry(e.target.value)}/></div>
 <div className="rm-field"><label htmlFor="rm-atr">ATR ($)</label><input id="rm-atr" type="number" min="0.0001" step="any" value={manualAtr} placeholder={data?.atr?String(Number(data.atr.value.toFixed(6))):'Enter ATR'} onChange={e=>setManualAtr(e.target.value)}/><small>{manualAtr.trim()?'Manual override':'Automatic FMP ATR'}</small></div>
 <div className="rm-field"><label htmlFor="rm-atr-mult">ATR multiplier</label><input id="rm-atr-mult" type="number" min="0.01" step="0.1" value={multiplier} onChange={e=>setMultiplier(e.target.value)}/><button className="rm-reset" type="button" onClick={()=>{setManualAtr('');setMultiplier(String(ATR_MULTIPLIER));}}>Restore automatic ATR</button></div>
 <div className="rm-field rm-full"><label>Direction</label><div className="rm-segments rm-direction" role="group" aria-label="Trade direction"><button type="button" aria-pressed={direction==='LONG'} onClick={()=>{if(direction!=='LONG'){setDirection('LONG');setStop('');}}}>Long</button><button type="button" aria-pressed={direction==='SHORT'} onClick={()=>{if(direction!=='SHORT'){setDirection('SHORT');setStop('');}}}>Short</button></div></div>
 <div className="rm-field rm-full"><label htmlFor="rm-stop">Manual stop-loss price ($) · optional</label><input id="rm-stop" type="number" min="0.0001" step="any" value={stop} onChange={e=>setStop(e.target.value)} placeholder="Leave blank to use ATR"/></div>
 <div className="rm-field"><label htmlFor="rm-slip">Slippage/share ($)</label><input id="rm-slip" type="number" min="0" step="any" value={slippage} onChange={e=>setSlippage(e.target.value)}/></div>
 <div className="rm-field"><label htmlFor="rm-fees">Round-trip fees ($)</label><input id="rm-fees" type="number" min="0" step="any" value={fees} onChange={e=>setFees(e.target.value)}/></div>
 </div>
 {data&&!size&&<p className="rm-card-note rm-warning">Enter a positive risk budget no greater than equity, valid costs, and a valid stop or ATR.</p>}
 <p className="rm-card-note rm-card-footer">A manual stop takes precedence. ATR overrides and multiplier changes affect this card only; risk, direction and costs are shared.</p>
 </section>
 </div>
 </div>
 </div>
 <p className="notice">Risk mode, dollar amount, account risk % and precise ATR multiplier are saved per account in this browser. FMP quotes are snapshots, not executable bid/ask prices; latency depends on your subscription. Extended-hours quotes are not explicitly requested. Margin ratio is a per-trade assumption (1:1 through 6:1; defaults to 2:1); estimated exposure is capped at equity × ratio and Webull buying power when available. This is not a guarantee of stock-specific margin or short availability. Verify actual entry, buying power, short locates and stop in Webull. Stops can slip or gap; losses can exceed estimates. No orders are placed.</p>
 </section>;
}
+activeSize.distance.toFixed(4):'—'}</strong></div>
 <div><small>Position value</small><strong>{activeSize?money(activeSize.notional):'—'}</strong></div>
 <div><small>Estimated loss incl. costs</small><strong className="rm-loss">{activeSize?money(activeSize.estimatedLoss):'—'}</strong></div>
 {sizingTab==='precise'&&<div><small>Risk-only shares</small><strong>{activeSize?activeSize.riskShares.toLocaleString():'—'}</strong></div>}
 </div></div>
 {activeStale&&<p className="rm-card-note rm-warning">Quote, balance or automatic ATR may be stale, or a refresh is pending or failed. Verify before trading.</p>}
 </section>
 <div className="rm-card rm-sizing-panel">
 <div className="rm-tabs" role="group" aria-label="Position sizing mode">
 <button type="button" aria-pressed={sizingTab==='quick'} onClick={()=>setSizingTab('quick')}>Quick Position Size</button>
 <button type="button" aria-pressed={sizingTab==='precise'} onClick={()=>setSizingTab('precise')}>Precise Position Sizing</button>
 </div>
 <section className="rm-tab-panel" hidden={sizingTab!=='quick'} aria-labelledby="rm-quick-title">
 <div className="rm-card-heading"><h2 id="rm-quick-title">Quick Position Size</h2><span className="rm-card-tag">Automatic ATR</span></div>
 <p className="rm-card-description">Volatility-adjusted share count from the latest FMP quote. No stop entry required.</p>
 <div className="rm-card-fields">
 <div className="rm-field"><label>Current stock price</label><div className="rm-readonly">{data?money(data.price):'—'}</div></div>
 <div className="rm-field"><label>5-minute ATR(14) · FMP</label><div className="rm-readonly">{data?.atr?'$'+data.atr.value.toFixed(4):'—'}</div></div>
 <div className="rm-field"><label>ATR multiplier</label><div className="rm-readonly">{ATR_MULTIPLIER.toFixed(1)}×</div></div>
 </div>
 <p className="rm-card-note">{data?.atr?'Last closed bar: '+stamp(data.atr.barClosedAt):'ATR is retrieved automatically with the quote.'}</p>
 {!quick&&<p className="rm-card-note">{data?(data.atr?'Enter valid risk and cost assumptions.':'FMP ATR unavailable. Use a manual stop or ATR override in the precise calculator.'):'Retrieve a ticker quote and account balance to calculate shares.'}</p>}
 {atrStale&&<p className="rm-card-note rm-warning">ATR is from an older session or delayed feed. Verify the timestamp.</p>}
 <p className="rm-card-note rm-card-footer">Uses 1.5× automatic ATR, shared risk and cost settings, margin ratio and available buying power. This is an estimate, not a technical stop.</p>
 </section>
 <section className="rm-tab-panel" hidden={sizingTab!=='precise'} aria-labelledby="rm-precise-title">
 <div className="rm-card-heading"><h2 id="rm-precise-title">Precise Position Sizing</h2><span className="rm-card-tag">Editable</span></div>
 <p className="rm-card-description">Adjust the ATR or enter your technical stop to calculate a trade-specific share count.</p>
 <div className="rm-card-fields">
 <div className="rm-field"><label htmlFor="rm-entry">Planned entry ($)</label><input id="rm-entry" type="number" min="0.0001" step="any" value={entry} onChange={e=>setEntry(e.target.value)}/></div>
 <div className="rm-field"><label htmlFor="rm-atr">ATR ($)</label><input id="rm-atr" type="number" min="0.0001" step="any" value={manualAtr} placeholder={data?.atr?String(Number(data.atr.value.toFixed(6))):'Enter ATR'} onChange={e=>setManualAtr(e.target.value)}/><small>{manualAtr.trim()?'Manual override':'Automatic FMP ATR'}</small></div>
 <div className="rm-field"><label htmlFor="rm-atr-mult">ATR multiplier</label><input id="rm-atr-mult" type="number" min="0.01" step="0.1" value={multiplier} onChange={e=>setMultiplier(e.target.value)}/><button className="rm-reset" type="button" onClick={()=>{setManualAtr('');setMultiplier(String(ATR_MULTIPLIER));}}>Restore automatic ATR</button></div>
 <div className="rm-field rm-full"><label>Direction</label><div className="rm-segments rm-direction" role="group" aria-label="Trade direction"><button type="button" aria-pressed={direction==='LONG'} onClick={()=>{if(direction!=='LONG'){setDirection('LONG');setStop('');}}}>Long</button><button type="button" aria-pressed={direction==='SHORT'} onClick={()=>{if(direction!=='SHORT'){setDirection('SHORT');setStop('');}}}>Short</button></div></div>
 <div className="rm-field rm-full"><label htmlFor="rm-stop">Manual stop-loss price ($) · optional</label><input id="rm-stop" type="number" min="0.0001" step="any" value={stop} onChange={e=>setStop(e.target.value)} placeholder="Leave blank to use ATR"/></div>
 <div className="rm-field"><label htmlFor="rm-slip">Slippage/share ($)</label><input id="rm-slip" type="number" min="0" step="any" value={slippage} onChange={e=>setSlippage(e.target.value)}/></div>
 <div className="rm-field"><label htmlFor="rm-fees">Round-trip fees ($)</label><input id="rm-fees" type="number" min="0" step="any" value={fees} onChange={e=>setFees(e.target.value)}/></div>
 </div>
 {data&&!size&&<p className="rm-card-note rm-warning">Enter a positive risk budget no greater than equity, valid costs, and a valid stop or ATR.</p>}
 <p className="rm-card-note rm-card-footer">A manual stop takes precedence. ATR overrides and multiplier changes affect this card only; risk, direction and costs are shared.</p>
 </section>
 </div>
 </div>
 <p className="notice">Risk mode, dollar amount, account risk % and precise ATR multiplier are saved per account in this browser. FMP quotes are snapshots, not executable bid/ask prices; latency depends on your subscription. Extended-hours quotes are not explicitly requested. Margin ratio is a per-trade assumption (1:1 through 6:1; defaults to 2:1); estimated exposure is capped at equity × ratio and Webull buying power when available. This is not a guarantee of stock-specific margin or short availability. Verify actual entry, buying power, short locates and stop in Webull. Stops can slip or gap; losses can exceed estimates. No orders are placed.</p>
 </section>;
}
