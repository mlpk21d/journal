import type {Metadata} from 'next';
import './globals.css';
import Navigation from '@/components/navigation';
import {accountWorkspace} from '@/lib/review/account-scope';
import {reviewIsLocal} from '@/lib/review/server';
export const metadata:Metadata={title:'Trade Journal',description:'Trading performance and journal analysis',icons:{icon:'/icon.svg'}};
export default async function RootLayout({children}:{children:React.ReactNode}){
 let accounts:Awaited<ReturnType<typeof accountWorkspace>>['accounts']=[];
 let selected:string|null=null;
 if(await reviewIsLocal())try{
  const workspace=await accountWorkspace();accounts=workspace.accounts;selected=workspace.selected;
 }catch(e){console.error('[Navigation] Could not load accounts',e);}
 return <html lang="en"><body><Navigation accounts={accounts} selected={selected}/>{children}</body></html>;
}
