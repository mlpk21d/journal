'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {NewTradeModal} from '@/components/new-trade-modal';
import {ImportTodayButton} from '@/components/import-today-button';
import {ACCOUNT_COOKIE,type WorkspaceAccount} from '@/lib/review/account-scope-shared';
import {useEffect,useState,type FormEvent} from 'react';
type Item={href:string;label:string;glyph:string};
const riskManagement:Item={href:'/risk-management',label:'Risk Management',glyph:'shield'};
function NavGlyph({glyph}:{glyph:string}){
 if(glyph==='shield')return <svg className="sj-risk-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 3 20 6v5c0 5-3.3 8.4-8 10-4.7-1.6-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
 return <>{glyph}</>;
}
const primary:Item[]=[
 {href:'/',label:'Dashboard',glyph:'▦'},
 {href:'/stats',label:'Statistics',glyph:'◔'},
 {href:'/calendar',label:'Calendar',glyph:'▣'},
 {href:'/review',label:'Trade Review',glyph:'☷'},
 {href:'/trades',label:'Trade History',glyph:'⇄'},
 {href:'/ticker-pnl',label:'P&L by Ticker',glyph:'▥'},
 {href:'/analytics',label:'Strategy Analytics',glyph:'⌁'},
 {href:'/daily',label:'Daily Performance',glyph:'▤'}
];
const research:Item[]=[
 {href:'/timing',label:'Trade Timing',glyph:'◷'},
 {href:'/insights',label:'Performance Insights',glyph:'✦'},
 {href:'/risk',label:'Risk & Trade Quality',glyph:'◎'},
 {href:'/performance',label:'Realized Performance',glyph:'▥'},
 {href:'/wash-sales',label:'Wash Sale Review',glyph:'◇'},
 {href:'/wash-sales/basis',label:'Tax Lot Preview',glyph:'▧'}
];
const actions:Item[]=[
 riskManagement,
 {href:'/manual',label:'Manual Entries',glyph:'⊞'},
 {href:'/import',label:'Import Trades',glyph:'⇧'},
 {href:'/import/schwab',label:'Import Schwab CSV',glyph:'↥'},
 {href:'/fees',label:'Fees',glyph:'＄'}
];
function NavItem({item,pathname,onNavigate}:{item:Item;pathname:string;onNavigate:()=>void}){
 const active=item.href==='/'?pathname==='/':pathname===item.href||pathname.startsWith(item.href+'/');
 return <Link href={item.href} aria-current={active?'page':undefined} className={'sj-nav-link'+(active?' sj-nav-active':'')} onClick={onNavigate}>
  <span className="sj-nav-icon" aria-hidden="true"><NavGlyph glyph={item.glyph}/></span><span>{item.label}</span>
 </Link>;
}
export default function Navigation({accounts,selected}:{accounts:WorkspaceAccount[];selected:string|null}){
 const pathname=usePathname();
 const router=useRouter();
 const [open,setOpen]=useState(false);
 const [query,setQuery]=useState('');
 const [accountOpen,setAccountOpen]=useState(false);
 const [tradeOpen,setTradeOpen]=useState(false);
 useEffect(()=>{setOpen(false);setAccountOpen(false);},[pathname]);
 useEffect(()=>{const fn=()=>setTradeOpen(true);window.addEventListener('trade-journal:new-trade',fn);return()=>window.removeEventListener('trade-journal:new-trade',fn);},[]);
 function selectAccount(id:string|null){
  document.cookie=ACCOUNT_COOKIE+'='+(id??'all')+'; Path=/; Max-Age=31536000; SameSite=Lax';
  setAccountOpen(false);
  router.replace(pathname);router.refresh();
 }
 useEffect(()=>{
  if(!open)return;
  function key(event:KeyboardEvent){if(event.key==='Escape')setOpen(false);}
  window.addEventListener('keydown',key);
  return()=>window.removeEventListener('keydown',key);
 },[open]);
 function search(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const symbol=query.trim().replace(/^\$/,'').toUpperCase();
  if(!symbol||!/^[A-Z0-9.^_-]{1,30}$/.test(symbol))return;
  router.push('/trades?symbol='+encodeURIComponent(symbol));setQuery('');
 }
 return <>
  <button className="sj-mobile-toggle" type="button" onClick={()=>setOpen(!open)} aria-label={open?'Close navigation':'Open navigation'} aria-expanded={open}>☰</button>
  {open&&<button className="sj-mobile-overlay" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
  <aside className={'sj-sidebar'+(open?' sj-sidebar-open':'')} aria-label="Main navigation">
   <Link href="/" className="sj-brand" onClick={()=>setOpen(false)}>
    <span className="sj-brand-mark" aria-hidden="true"><img src="/icon.svg" alt="" className="sj-brand-icon"/></span><span>Trade Journal</span>
   </Link>
   <div className="sj-account-select">
    <button className="sj-account-picker" type="button" aria-expanded={accountOpen} aria-controls="sj-account-options" onClick={()=>setAccountOpen(v=>!v)}>
     <span className="sj-account-dot"/><span>{accounts.find(a=>a.id===selected)?.label??'All Accounts'}</span><span aria-hidden="true">⌄</span>
    </button>
    {accountOpen&&<div id="sj-account-options" className="sj-account-options" role="group" aria-label="Active brokerage account">
     <button type="button" className={!selected?'sj-account-selected':''} onClick={()=>selectAccount(null)}>All Accounts</button>
     {accounts.map(a=><button key={a.id} type="button" className={selected===a.id?'sj-account-selected':''} onClick={()=>selectAccount(a.id)}>
      <span>{a.label}</span><small>{a.broker==='schwab'?'Schwab':a.broker==='manual'?'Manual':'Webull'}</small>
     </button>)}
     <Link href="/settings" onClick={()=>{setAccountOpen(false);setOpen(false);}}>Manage accounts ↗</Link>
    </div>}
   </div>
   <div className="sj-nav-scroll">
    <nav aria-label="Journal pages" className="sj-nav-section">
     {primary.map(item=><NavItem key={item.href} item={item} pathname={pathname} onNavigate={()=>setOpen(false)}/>)}
    </nav>
    <div className="sj-nav-section-heading">RESEARCH</div>
    <nav aria-label="Analytics reports" className="sj-nav-section">
     {research.map(item=><NavItem key={item.href} item={item} pathname={pathname} onNavigate={()=>setOpen(false)}/>)}
    </nav>
    <div className="sj-nav-section-heading">TRADE MANAGEMENT</div>
    <nav aria-label="Trade actions" className="sj-nav-section">
     <button type="button" className="sj-nav-link sj-nav-action" onClick={()=>{setTradeOpen(true);setOpen(false);}}>
      <span className="sj-nav-icon" aria-hidden="true">⊞</span><span>New Trade</span>
     </button>
     {actions.map(item=><NavItem key={item.href} item={item} pathname={pathname} onNavigate={()=>setOpen(false)}/>)}
    </nav>
    <div className="sj-nav-section-heading">WORKSPACE</div>
    <nav className="sj-nav-section" aria-label="Settings"><NavItem item={{href:'/settings',label:'Settings',glyph:'⚙'}} pathname={pathname} onNavigate={()=>setOpen(false)}/></nav>
   </div>
   <div className="sj-sidebar-footer"><span className="sj-account-dot"/> Local workspace <small>Read-only brokerage connection</small></div>
  </aside>
  <div className="sj-icon-rail" aria-label="Quick navigation">
   {[...primary.slice(0,3),riskManagement,...actions.filter(item=>item.href!==riskManagement.href),...research.slice(0,3)].map(item=>
    <Link key={item.href} href={item.href} title={item.label} aria-label={item.label} aria-current={pathname===item.href?'page':undefined} className={pathname===item.href?'sj-rail-active':''}>
     <NavGlyph glyph={item.glyph}/>
    </Link>)}
  </div>
  <div className="sj-topbar">
   <span className="sj-topbar-name">TRADING WORKSPACE</span>
   <span className="sj-topbar-divider"/>
   <Link href="/performance" className="sj-topbar-performance">Realized Performance <span>↗</span></Link>
   <div className="sj-topbar-spacer"/>
   <form className="sj-topbar-search" onSubmit={search} role="search">
    <label className="sj-sr-only" htmlFor="sj-search-symbol">Search ticker</label>
    <span aria-hidden="true">⌕</span>
    <input id="sj-search-symbol" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search ticker"/>
    <button type="submit" aria-label="Search trades">↵</button>
   </form>
   <ImportTodayButton accounts={accounts} selected={selected}/>
   <button className="sj-topbar-quick" type="button" onClick={()=>setTradeOpen(true)}>＋ New Trade</button>
  </div>
  {tradeOpen&&<NewTradeModal accounts={accounts} selected={selected} onClose={()=>setTradeOpen(false)}/>}
 </>;
}
