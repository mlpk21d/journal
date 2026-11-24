import type {ReviewedTrade} from './trade-review.ts';

export const DASHBOARD_TRADES_PAGE_SIZE=50;

/** Stable newest-first completed cycles. The page is bounded to valid rows. */
export function paginateDashboardTrades(trades:ReviewedTrade[],page:number){
 const ordered=[...trades].sort((a,b)=>b.exitedAt.localeCompare(a.exitedAt)||b.id.localeCompare(a.id));
 const totalPages=Math.max(1,Math.ceil(ordered.length/DASHBOARD_TRADES_PAGE_SIZE));
 const safePage=Number.isSafeInteger(page)?page:1;
 const currentPage=Math.max(1,Math.min(safePage,totalPages));
 const start=(currentPage-1)*DASHBOARD_TRADES_PAGE_SIZE;
 return {ordered,totalPages,currentPage,start,visible:ordered.slice(start,start+DASHBOARD_TRADES_PAGE_SIZE)};
}
