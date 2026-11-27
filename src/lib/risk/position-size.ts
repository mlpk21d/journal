export type RiskBudget={riskPercent:number;riskDollars?:never}|{riskDollars:number;riskPercent?:never};
export type SizeInput=RiskBudget & {equity:number;buyingPower:number|null;entry:number;stop:number;slippage:number;fees:number;direction:'LONG'|'SHORT'};
export function positionSize(i:SizeInput){
 const {equity,buyingPower,entry,stop,slippage,fees,direction}=i;
 if(![equity,entry,stop,slippage,fees].every(Number.isFinite)||equity<=0||entry<=0||stop<=0||slippage<0||fees<0||!['LONG','SHORT'].includes(direction)||(direction==='LONG'?stop>=entry:stop<=entry)||(buyingPower!==null&&(!Number.isFinite(buyingPower)||buyingPower<0)))return null;
 const budget=i.riskDollars!==undefined?i.riskDollars:equity*(i.riskPercent??NaN)/100;
 if(!Number.isFinite(budget)||budget<=0||budget>equity)return null;
 const distance=Math.abs(entry-stop);
 const perShare=distance+slippage;
 const riskShares=Math.max(0,Math.floor((budget-fees)/perShare+1e-10));
 const buyingPowerShares=buyingPower===null?null:Math.floor(buyingPower/entry);
 const shares=buyingPowerShares===null?riskShares:Math.min(riskShares,buyingPowerShares);
 if(!Number.isSafeInteger(shares))return null;
 return {budget,distance,perShare,riskShares,buyingPowerShares,shares,notional:shares*entry,estimatedLoss:shares?shares*perShare+fees:0};
}

/** Quote-based preview only: an assumed adverse move, not a technical stop. */
export function quickPositionSize(i:Omit<SizeInput,'stop'|'riskPercent'|'riskDollars'> & RiskBudget & {movePercent:number}){
 const {movePercent,...inputs}=i;
 if(!Number.isFinite(movePercent)||movePercent<=0||movePercent>=100)return null;
 const distance=inputs.entry*movePercent/100;
 const stop=inputs.entry+(inputs.direction==='LONG'?-distance:distance);
 return positionSize({...inputs,stop});
}
