/** Shared server-side validation for manually entered stock activity.
 * This module has no Next.js or database imports, so validation is independently testable.
 */
export type ManualTradeInput={
 account:string;symbol:string;timestamp:string;side:'BUY'|'SELL';
 entryType:'OPENING'|'TRADE';quantity:string;price:string;fees:string;notes:string
};
const decimal=/^\d+(?:\.\d{1,8})?$/;
export function validateManualTrade(form:FormData):ManualTradeInput{
 const account=String(form.get('account')??'').trim();
 if(!/^\d{1,19}$/.test(account))throw new Error('Brokerage account: choose an account from the list.');
 const symbol=String(form.get('symbol')??'').trim().replace(/^\$/,'').toUpperCase();
 if(!/^[A-Z0-9.^_-]{1,30}$/.test(symbol))throw new Error('Ticker: enter a valid stock symbol, such as AMZN.');
 const date=String(form.get('date')??'').trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Date: choose the trade or acquisition date.');
 const rawTime=String(form.get('time')??'12:00').trim();
 // HTML time inputs may submit HH:MM or HH:MM:SS depending on browser.
 if(!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(rawTime))
  throw new Error('Time: enter a valid time in UTC.');
 const time=rawTime.length===5?rawTime+':00':rawTime;
 const side=String(form.get('side')??'');
 if(side!=='BUY'&&side!=='SELL')throw new Error('Side: choose BUY or SELL.');
 const entryType=String(form.get('entryType')??'');
 if(entryType!=='OPENING'&&entryType!=='TRADE')throw new Error('Entry type: choose Trade or Opening shares.');
 if(entryType==='OPENING'&&side!=='BUY')
  throw new Error('Entry type: Opening shares can only be BUY. Choose Trade for a SELL.');
 const quantity=String(form.get('quantity')??'').trim();
 if(!decimal.test(quantity)||Number(quantity)<=0||Number(quantity)>1e12)
  throw new Error('Shares: enter a quantity greater than zero, with at most 8 decimal places.');
 const price=String(form.get('price')??'').trim();
 if(!decimal.test(price)||Number(price)>1e12)
  throw new Error('Price: enter a nonnegative amount (0 is allowed), with at most 8 decimal places.');
 const fees=String(form.get('fees')??'0').trim()||'0';
 if(!decimal.test(fees)||Number(fees)>1e12)
  throw new Error('Fees: enter a nonnegative amount, with at most 8 decimal places.');
 const notes=String(form.get('notes')??'').trim();
 if(notes.length>400)throw new Error('Notes: maximum 400 characters.');
 const timestamp=new Date(date+'T'+time+'.000Z');
 if(!Number.isFinite(timestamp.getTime())||timestamp.toISOString().slice(0,19)!==date+'T'+time)
  throw new Error('Date/time: enter a valid calendar date and time.');
 if(timestamp.getTime()>Date.now())throw new Error('Date/time: trades cannot be entered in the future.');
 if(form.get('acknowledged')!=='yes')
  throw new Error('Confirmation: check the acknowledgment of unverified manual data.');
 return {account,symbol,timestamp:timestamp.toISOString(),side,entryType,quantity,price,fees,notes};
}
