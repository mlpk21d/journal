import {formatBrokerageAccount} from '../webull/account-format.ts';
export type AccountLabelRow={broker:string;user_label:string|null;account_type:string|null;external_account_id:string};
export function displayAccount(a:AccountLabelRow):string{
 return a.broker==='manual'||a.broker==='schwab'?(a.user_label?.trim()||(a.broker==='schwab'?'Charles Schwab':'Manual brokerage')):formatBrokerageAccount(a.account_type,a.external_account_id);
}
