/** Percentage widths for the compact Dashboard summary bars.
 * Bar families are comparable within their own group only:
 * counts compared with counts, and dollar averages with dollar averages.
 */
export function metricBarWidth(value:number,maximum:number):number{
 if(!Number.isFinite(value)||value<=0)return 2;
 if(!Number.isFinite(maximum)||maximum<=0)return 2;
 return Math.max(2,Math.min(100,value/maximum*100));
}
export function dashboardBarScales(metrics:{
 wins:number;losses:number;open:number;washSales:number;
 averageWin:number;averageLoss:number;
}){
 const counts=Math.max(1,metrics.wins,metrics.losses,metrics.open,metrics.washSales);
 const dollars=Math.max(1,Math.abs(metrics.averageWin),Math.abs(metrics.averageLoss));
 return {
  wins:metricBarWidth(metrics.wins,counts),
  losses:metricBarWidth(metrics.losses,counts),
  open:metricBarWidth(metrics.open,counts),
  washSales:metricBarWidth(metrics.washSales,counts),
  averageWin:metricBarWidth(Math.abs(metrics.averageWin),dollars),
  averageLoss:metricBarWidth(Math.abs(metrics.averageLoss),dollars)
 };
}
