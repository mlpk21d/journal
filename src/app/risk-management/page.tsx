import Link from 'next/link';
import {reviewIsLocal} from '@/lib/review/server';
import {accountWorkspace} from '@/lib/review/account-scope';
import {RiskCalculator} from '@/components/risk-calculator';
export const dynamic='force-dynamic';
export default async function RiskManagementPage(){
 if(!await reviewIsLocal())return <main className="shell"><p className="notice">Risk Management is restricted to local development.</p></main>;
 const {accounts,selected}=await accountWorkspace();
 const account=accounts.find(a=>a.id===selected);
 return <main className="shell review-shell">
 {account?.broker==='webull'?<RiskCalculator key={account.id} accountId={account.id} label={account.label}/>:<><section className="page-title"><p className="eyebrow">TRADE MANAGEMENT / PRE-TRADE</p><h1>Risk Management</h1></section><nav className="pill-row"><Link href="/risk">Risk &amp; Trade Quality ↗</Link></nav><p className="notice">Select one Webull brokerage account in the sidebar. All Accounts, Schwab and manual accounts cannot supply live Webull equity.</p></>}
 </main>;
}
