'use client';
export function NewTradeButton({children,className}:{children:React.ReactNode;className?:string}){
 return <button type="button" className={className??'sj-add-trade'} onClick={()=>window.dispatchEvent(new Event('trade-journal:new-trade'))}>{children}</button>;
}
