'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
const links=[
 {href:'/',name:'Dashboard'},
 {href:'/import',name:'Import Trades'},
 {href:'/manual',name:'Manual Trades'},
 {href:'/trades',name:'Trade History'},
 {href:'/performance',name:'Realized Performance'}
];
export default function Navigation(){
 const [open,setOpen]=useState(false);
 const pathname=usePathname();
 const button=useRef<HTMLButtonElement>(null);
 const drawer=useRef<HTMLElement>(null);
 useEffect(()=>setOpen(false),[pathname]);
 useEffect(()=>{
  if(!open)return;
  function onKey(e:KeyboardEvent){if(e.key==='Escape'){setOpen(false);button.current?.focus();}}
  document.addEventListener('keydown',onKey);
  const old=document.body.style.overflow;document.body.style.overflow='hidden';
  drawer.current?.focus();
  return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=old;};
 },[open]);
 return <>
  <button ref={button} className="nav-menu-button" type="button" aria-label="Open navigation" aria-expanded={open} aria-controls="journal-menu" onClick={()=>setOpen(true)}>
   <span/><span/><span/>
  </button>
  {open&&<div className="nav-overlay" onClick={()=>setOpen(false)} aria-hidden="true"/>}
  <aside id="journal-menu" className={'nav-drawer'+(open?' nav-drawer-open':'')} aria-hidden={!open} aria-label="Site navigation" tabIndex={-1} ref={drawer}>
   <div className="nav-drawer-head"><strong>TRADE / JOURNAL</strong><button onClick={()=>{setOpen(false);button.current?.focus();}} type="button" aria-label="Close menu">×</button></div>
   <nav aria-label="Main navigation">{links.map(l=><Link key={l.href} tabIndex={open?0:-1} aria-current={pathname===l.href?'page':undefined} href={l.href} onClick={()=>setOpen(false)}>{l.name}</Link>)}</nav>
   <p>Local development · Read-only Webull integration</p>
  </aside>
 </>;
}
