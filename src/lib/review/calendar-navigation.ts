export function validCalendarMonth(value:string){return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);}
export function shiftCalendarMonth(month:string,offset:number){
 if(!validCalendarMonth(month)||!Number.isInteger(offset)||Math.abs(offset)>1200)throw new Error('Invalid calendar month navigation');
 const [year,number]=month.split('-').map(Number);
 const next=new Date(Date.UTC(year,number-1+offset,1));
 if(!Number.isFinite(next.getTime()))throw new Error('Invalid calendar month navigation');
 return next.toISOString().slice(0,7);
}
export function calendarMonthLabel(month:string){
 if(!validCalendarMonth(month))throw new Error('Invalid calendar month');
 const [year,number]=month.split('-').map(Number);
 return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(Date.UTC(year,number-1,1)));
}
