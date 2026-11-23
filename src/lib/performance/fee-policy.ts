/** Webull omits fee rows for zero-fee executions.
 * For provisional journal P&L, treat missing order-fee rows as $0 as requested.
 * Explicit nonzero fee totals are preserved. Manual trade fees are supplied
 * separately and should not use this normalization.
 */
export function normalizeWebullOrderFee(fees:string|null):{fees:string;feeKnown:true}{
 return {fees:fees??'0',feeKnown:true};
}
