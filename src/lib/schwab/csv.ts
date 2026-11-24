import {createHash} from 'node:crypto';
export type SchwabTrade={kind:'trade';date:string;timestamp:string;symbol:string;side:'BUY'|'SELL';action:string;
 quantity:string;price:string;fees:string;key:string;line:number;description:string};
export type SchwabFee={kind:'fee';date:string;feeType:string;description:string;amount:string;key:string;line:number};
export type SchwabImportRow=SchwabTrade|SchwabFee;
export type SchwabPreview={rows:SchwabImportRow[];ignored:number;wireSent:number;trades:number;fees:number;warnings:string[]};
const required=['Date','Action','Symbol','Description','Quantity','Price','Fees & Comm','Amount'];
function cells(text:string):string[][]{
 const result:string[][]=[];let row:string[]=[],field='',quoted=false;
 const s=text.replace(/^\uFEFF/,'');
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(quoted){
   if(c==='"'&&s[i+1]==='"'){field+='"';i++;}
   else if(c==='"')quoted=false;
   else field+=c;
  }else if(c==='"')quoted=true;
  else if(c===','){row.push(field);field='';}
  else if(c==='\n'){row.push(field);result.push(row);row=[];field='';}
  else if(c==='\r')continue;
  else field+=c;
 }
 if(quoted)throw new Error('CSV has an unterminated quote');
 if(field!==''||row.length){row.push(field);result.push(row);}
 return result;
}
function number(value:string,requiredValue:boolean):string|null{
 const s=value.trim();
 if(!s)return requiredValue?null:'0';
 const cleaned=s.replace(/^\$/,'').replace(/,/g,'').trim();
 if(!/^\d+(?:\.\d{1,8})?$/.test(cleaned))return null;
 const n=Number(cleaned);
 return Number.isFinite(n)&&n>=0&&n<=1e12?cleaned:null;
}
function signedAmount(value:string):number|null{
 const s=value.trim().replace(/[$,]/g,'');
 const neg=s.startsWith('(')&&s.endsWith(')');
 const clean=neg?s.slice(1,-1):s;
 if(!/^-?\d+(?:\.\d+)?$/.test(clean))return null;
 const n=Number(clean);
 return Number.isFinite(n)?(neg?-n:n):null;
}
function date(value:string):string|null{
 const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
 if(!m)return null;
 const iso=m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');
 return new Date(iso+'T00:00:00Z').toISOString().slice(0,10)===iso?iso:null;
}
const et=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',
 day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function easternMorning(iso:string,ordinal:number):string{
 if(ordinal>=3600)throw new Error('More than 3,600 trades on one day; cannot assign unique morning seconds');
 const [y,m,d]=iso.split('-').map(Number);
 const desired=Date.UTC(y,m-1,d,9,30,ordinal);
 let instant=desired+4*3600000;
 for(let i=0;i<4;i++){
  const parts=et.formatToParts(new Date(instant));
  const get=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
  const actual=Date.UTC(get('year'),get('month')-1,get('day'),get('hour'),get('minute'),get('second'));
  const diff=desired-actual;
  if(diff===0)return new Date(instant).toISOString();
  instant+=diff;
 }
 throw new Error('Unable to assign a New York morning timestamp');
}
/** Schwab exports are newest-first, including within each date. We reverse
 * the file's row sequence to reconstruct oldest-to-newest order, and give
 * each fill a different 09:30:00–10:29:59 Eastern synthetic timestamp.
 * Intraday order is an assumption; never represent it as actual broker time.
 */
export function parseSchwabCsv(text:string):SchwabPreview{
 if(text.length>2_000_000)throw new Error('CSV exceeds the 2 MB limit');
 const raw=cells(text);
 if(!raw.length)throw new Error('Empty Schwab CSV');
 const headers=raw[0].map(h=>h.trim());
 if(required.some(x=>!headers.includes(x)))throw new Error('Expected a Charles Schwab Transactions CSV with Date, Action, Symbol, Description, Quantity, Price, Fees & Comm, Amount');
 const index=(name:string)=>headers.indexOf(name);
 const staged:Array<{date:string;action:string;symbol:string;quantity:string;price:string;fees:string;amount:number|null;description:string;line:number;key:string}>=[];
 const repeats=new Map<string,number>();
 let ignored=0,wireSent=0;
 for(let i=1;i<raw.length;i++){
  const row=raw[i];
  if(row.every(x=>!x.trim()))continue;
  const val=(name:string)=>(row[index(name)]??'').trim();
  const action=val('Action');
  if(action==='Wire Sent'){wireSent++;continue;}
  if(!['Buy','Sell','Sell Short','Buy to Cover','Service Fee'].includes(action)){ignored++;continue;}
  const day=date(val('Date'));
  if(!day)throw new Error('Invalid trade/fee date on CSV line '+(i+1));
  const canonical=required.map(k=>val(k)).join('\u001f');
  const count=repeats.get(canonical)??0;
  repeats.set(canonical,count+1);
  const key=createHash('sha256').update(canonical+'\u001f'+count).digest('hex');
  staged.push({date:day,action,symbol:val('Symbol').toUpperCase(),quantity:val('Quantity'),
   price:val('Price'),fees:val('Fees & Comm'),amount:signedAmount(val('Amount')),
   description:val('Description'),line:i+1,key});
 }
 const rows:SchwabImportRow[]=[];
 const perDay=new Map<string,number>();
 for(const r of staged.reverse()){
  if(r.action==='Service Fee'){
   if(r.amount===null||r.amount>=0)throw new Error('Expected a negative service fee on CSV line '+r.line);
   rows.push({kind:'fee',date:r.date,feeType:'Service Fee',description:r.description,
    amount:String(-r.amount),key:r.key,line:r.line});
   continue;
  }
  if(!/^[A-Z0-9.^_-]{1,30}$/.test(r.symbol))throw new Error('Invalid symbol on CSV line '+r.line);
  const quantity=number(r.quantity,true),price=number(r.price,true),fees=number(r.fees,false);
  if(quantity===null||Number(quantity)<=0||price===null||fees===null)
   throw new Error('Invalid shares, price or fees on CSV line '+r.line);
  const slot=perDay.get(r.date)??0;
  perDay.set(r.date,slot+1);
  rows.push({kind:'trade',date:r.date,timestamp:easternMorning(r.date,slot),
   symbol:r.symbol,action:r.action,side:['Buy','Buy to Cover'].includes(r.action)?'BUY':'SELL',
   quantity,price,fees,key:r.key,description:r.description,line:r.line});
 }
 return {rows,trades:rows.filter(x=>x.kind==='trade').length,fees:rows.filter(x=>x.kind==='fee').length,
  ignored,wireSent,warnings:['Trade times are synthetic 9:30 AM Eastern plus sequential seconds, in reverse CSV export order; intraday FIFO/P&L may not match actual execution order.']};
}
