/** Table column policy for completed trade review. Keep this independent of React
 * so required columns and persisted visibility can be regression-tested.
 */
export const REVIEW_COLUMNS=[
 {key:'ticker',label:'Ticker',required:true},
 {key:'account',label:'Account',required:false},
 {key:'direction',label:'Direction',required:true},
 {key:'quantity',label:'Quantity',required:false},
 {key:'entryPrice',label:'Entry price',required:false},
 {key:'exitPrice',label:'Exit price',required:false},
 {key:'enteredAt',label:'Entry (UTC)',required:false},
 {key:'exitedAt',label:'Exit (UTC)',required:false},
 {key:'duration',label:'Duration',required:false},
 {key:'gross',label:'Gross P&L',required:false},
 {key:'fees',label:'Fees',required:false},
 {key:'net',label:'Net P&L',required:true}
] as const;
export type ReviewColumnKey=(typeof REVIEW_COLUMNS)[number]['key'];
export const REQUIRED_REVIEW_COLUMNS=REVIEW_COLUMNS.filter(c=>c.required).map(c=>c.key);
export function normalizeReviewColumns(value:unknown):ReviewColumnKey[]{
 const requested=Array.isArray(value)?new Set(value.filter((x):x is string=>typeof x==='string')):null;
 return REVIEW_COLUMNS.filter(c=>c.required||requested===null||requested.has(c.key)).map(c=>c.key);
}
