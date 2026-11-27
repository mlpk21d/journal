export class FmpQuoteError extends Error {
 constructor(public readonly code:'MISSING_KEY'|'HTTP'|'INVALID_QUOTE'|'CONNECTION',public readonly status?:number){super('FMP quote unavailable');this.name='FmpQuoteError';}
}
export function parseFmpQuote(raw:unknown,symbol:string,now=Date.now()){
 const row=Array.isArray(raw)?raw.find(r=>r&&typeof r==='object'&&r.symbol===symbol):undefined;
 const price=row?.price;
 if(typeof price!=='number'||!Number.isFinite(price)||price<=0)throw new FmpQuoteError('INVALID_QUOTE');
 const t=row?.timestamp;
 const ms=typeof t==='number'&&Number.isFinite(t)?(t<1e12?t*1000:t):NaN;
 return {price,quoteTime:Number.isFinite(ms)&&ms>0&&ms<=now+60000?ms:null,quoteFetchedAt:now};
}
