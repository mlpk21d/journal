'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect,useState,type FormEvent} from 'react';
type Item={href:string;label:string;glyph:string};
const primary:Item[]=[
 {href:'/',label:'Dashboard',glyph:'▦'},
 {href:'/stats',label:'Statistics',glyph:'◔'},
 {href:'/calendar',label:'Calendar',glyph:'▣'},
 {href:'/review',label:'Trade Review',glyph:'☷'},
 {href:'/trades',label:'Trade History',glyph:'⇄'},
 {href:'/analytics',label:'Strategy Analytics',glyph:'⌁'},
 {href:'/daily',label:'Daily Performance',glyph:'▤'}
];
const research:Item[]=[
 {href:'/timing',label:'Trade Timing',glyph:'◷'},
 {href:'/insights',label:'Performance Insights',glyph:'✦'},
 {href:'/risk',label:'Risk & Trade Quality',glyph:'◎'},
 {href:'/performance',label:'Realized Performance',glyph:'▥'}
];
const actions:Item[]=[
 {href:'/manual',label:'New Trade',glyph:'⊞'},
 {href:'/import',label:'Import Trades',glyph:'⇧'}
];
function NavItem({item,pathname,onNavigate}:{item:Item;pathname:string;onNavigate:()=>void}){
 const active=item.href==='/'?pathname==='/':pathname===item.href||pathname.startsWith(item.href+'/');
 return <Link href={item.href} aria-current={active?'page':undefined} className={'sj-nav-link'+(active?' sj-nav-active':'')} onClick={onNavigate}>
  <span className="sj-nav-icon" aria-hidden="true">{item.glyph}</span><span>{item.label}</span>
 </Link>;
}
export default function Navigation(){
 const pathname=usePathname();
 const router=useRouter();
 const [open,setOpen]=useState(false);
 const [query,setQuery]=useState('');
 useEffect(()=>setOpen(false),[pathname]);
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
    <span className="sj-brand-mark" aria-hidden="true">◈</span><span>Trade Journal</span>
   </Link>
   <div className="sj-account-picker"><span className="sj-account-dot"/> <span>All Accounts</span></div>
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
     {actions.map(item=><NavItem key={item.href} item={item} pathname={pathname} onNavigate={()=>setOpen(false)}/>)}
    </nav>
   </div>
   <div className="sj-sidebar-footer"><span className="sj-account-dot"/> Local workspace <small>Read-only brokerage connection</small></div>
  </aside>
  <div className="sj-icon-rail" aria-label="Quick navigation">
   {[...primary.slice(0,3),...actions,...research.slice(0,3)].map(item=>
    <Link key={item.href} href={item.href} title={item.label} aria-label={item.label} className={pathname===item.href?'sj-rail-active':''}>
     {item.glyph}
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
   <Link className="sj-topbar-quick" href="/manual" title="Enter a trade">＋ New Trade</Link>
  </div>
 </>;
}
