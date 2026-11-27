export type RiskBudget={riskPercent:number;riskDollars?:never}|{riskDollars:number;riskPercent?:never};
export const MARGIN_RATIOS=[1,2,3,4,5,6] as const;
export type MarginRatio=typeof MARGIN_RATIOS[number];
export type SizeInput=RiskBudget & {equity:number;buyingPower:number|null;marginRatio?:MarginRatio;entry:number;stop:number;slippage:number;fees:number;direction:'LONG'|'SHORT'};
export function positionSize(i:SizeInput){
 const {equity,buyingPower,marginRatio=2,entry,stop,slippage,fees,direction}=i;
 if(!MARGIN_RATIOS.includes(marginRatio)||![equity,entry,stop,slippage,fees].every(Number.isFinite)||equity<=0||entry<=0||stop<=0||slippage<0||fees<0||!['LONG','SHORT'].includes(direction)||(direction==='LONG'?stop>=entry:stop<=entry)||(buyingPower!==null&&(!Number.isFinite(buyingPower)||buyingPower<0)))return null;
 const budget=i.riskDollars!==undefined?i.riskDollars:equity*(i.riskPercent??NaN)/100;
 if(!Number.isFinite(budget)||budget<=0||budget>equity)return null;
 const distance=Math.abs(entry-stop);
 const perShare=distance+slippage;
 const riskShares=Math.max(0,Math.floor((budget-fees)/perShare+1e-10));
 const buyingPowerShares=buyingPower===null?null:Math.floor(buyingPower/entry);
 const marginShares=Math.floor(equity*marginRatio/entry);
 const shares=Math.min(riskShares,marginShares,buyingPowerShares??Infinity);
 if(!Number.isSafeInteger(shares))return null;
 return {budget,distance,perShare,riskShares,buyingPowerShares,marginShares,shares,notional:shares*entry,estimatedLoss:shares?shares*perShare+fees:0};
}

/** Quote-based preview only: an assumed adverse move, not a technical stop. */
export function quickPositionSize(i:Omit<SizeInput,'stop'|'riskPercent'|'riskDollars'> & RiskBudget & {movePercent:number}){
 const {movePercent,...inputs}=i;
 if(!Number.isFinite(movePercent)||movePercent<=0||movePercent>=100)return null;
 const distance=inputs.entry*movePercent/100;
 const stop=inputs.entry+(inputs.direction==='LONG'?-distance:distance);
 return positionSize({...inputs,stop});
}

export function atrPositionSize(i:Omit<SizeInput,'stop'|'riskPercent'|'riskDollars'> & RiskBudget & {atr:number;multiplier:number}){
 const {atr,multiplier,...inputs}=i;
 if(!Number.isFinite(atr)||atr<=0||!Number.isFinite(multiplier)||multiplier<=0)return null;
 const distance=atr*multiplier;
 const stop=inputs.entry+(inputs.direction==='LONG'?-distance:distance);
 return positionSize({...inputs,stop});
}
