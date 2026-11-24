import 'server-only';
import {cookies} from 'next/headers';
import {db} from '@/lib/db';
import {displayAccount} from '@/lib/review/account-label';

export const ACCOUNT_COOKIE='trade-journal-active-account-v1';
export type WorkspaceAccount={id:string;label:string;broker:string};
/** A single server-readable account scope for all trade analytics and tables. */
export async function activeAccountId():Promise<string|null>{
 const raw=(await cookies()).get(ACCOUNT_COOKIE)?.value;
 return raw&&/^\d{1,19}$/.test(raw)?raw:null;
}
export async function accountWorkspace(){
 const rows=(await db().query<{id:string;broker:string;external_account_id:string;account_type:string|null;user_label:string|null}>(
  'SELECT id::text,broker,external_account_id,account_type,user_label FROM brokerage_accounts ORDER BY broker,id')).rows;
 const accounts:WorkspaceAccount[]=rows.map(a=>({id:a.id,broker:a.broker,label:displayAccount(a)}));
 const selected=await activeAccountId();
 return {accounts,selected:selected&&accounts.some(a=>a.id===selected)?selected:null};
}
