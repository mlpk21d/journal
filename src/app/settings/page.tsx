import {reviewIsLocal} from '@/lib/review/server';
import {accountWorkspace} from '@/lib/review/account-scope';
import {AccountSettingsForm} from '@/components/account-settings-form';
export const dynamic='force-dynamic';
export default async function SettingsPage(){
 if(!await reviewIsLocal())return <main className="shell"><p className="notice">Settings are restricted to the local workspace.</p></main>;
 let accounts:Awaited<ReturnType<typeof accountWorkspace>>['accounts']=[];
 let error='';
 try{accounts=(await accountWorkspace()).accounts;}
 catch(e){console.error('[Settings] Could not load accounts',e);error='Unable to load accounts; check database connection.';}
 return <main className="shell sj-settings-page">
  <div className="sj-page-head"><div><p className="sj-kicker">WORKSPACE</p><h1>Settings</h1>
   <p>Configure brokerage accounts and future journal preferences.</p></div></div>
  <section className="sj-settings-panel"><div className="sj-section-heading"><div><h2>Brokerage Accounts</h2>
   <p>Saved brokerage accounts used by manual trades, imported records and analytics.</p></div></div>
   {error?<p className="notice">{error}</p>:<><div className="sj-settings-accounts">
    {accounts.map(a=><div className="sj-settings-account" key={a.id}>
     <span className="sj-account-dot"/><strong>{a.label}</strong><small>{a.broker==='schwab'?'Schwab CSV account':a.broker==='manual'?'Manual account':'Webull-connected account'}</small>
    </div>)}
    {!accounts.length&&<p className="helper">No accounts saved yet.</p>}
   </div>
   <h3>Add a Brokerage Account</h3>
   <p className="helper">Create a named Schwab account for CSV imports or another manual brokerage account. This does not connect to Schwab's API.</p>
   <AccountSettingsForm/></>}
  </section>
  <section className="sj-settings-panel sj-settings-tax-import">
   <div className="sj-section-heading"><div>
    <h2>Tax Imports</h2>
    <p>Brokerage tax records and Form 1099-B reconciliation.</p>
   </div></div>
   <p className="helper">Planned feature. CSV tax-statement upload, brokerage field mapping, duplicate detection and wash-sale reconciliation will be added when tax documents are available.</p>
   <p className="sj-settings-coming-soon">Not available yet — no upload or tax records are changed.</p>
  </section>
 </main>;
}
