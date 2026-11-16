/* Batch edits use the existing per-period customer fields; blank is distinct from zero. */
function createVATBulkPolicy215(){
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x)),dateFields=['appointmentDate','plannedTaxPayDate'];
 function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000'))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value;}
 function amount(raw){
  const text=String(raw??'').normalize('NFKC').trim();
  if(!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text))throw new Error('稅額請填有效數字，最多兩位小數；可填 0 或負數留底');
  const negative=text.startsWith('-'),[whole,fraction='']=text.replace(/^-/,'').replace(/,/g,'').split('.'),cents=BigInt(whole)*100n+BigInt((fraction+'00').slice(0,2));
  if(cents>99999999999999n)throw new Error('稅額超出範圍');return (negative?-1:1)*Number(cents)/100;
 }
 function hasTax(pc){if(pc.taxAmount==null||String(pc.taxAmount).trim()==='')return false;try{amount(pc.taxAmount);return true}catch{return false}}
 function matches(pc,filters={}){
  const date=validDate(pc[filters.dateField||'appointmentDate']),tax=hasTax(pc);
  return (filters.date==='set'?date:filters.date==='missing'?!date:true)&&(filters.tax==='set'?tax:filters.tax==='missing'?!tax:true);
 }
 function eligible(pc,action){return !pc.notApplicable&&(action!=='paid'||hasTax(pc)&&amount(pc.taxAmount)>0&&!pc.taxPaid)}
 function plan(input,data,at){
  const period=data.periods.find(p=>p.id===input.periodId);if(!period)throw new Error('期別已不存在');if(period.status==='已結束'&&!period.unlocked)throw new Error('此期已結束，請先解鎖');
  if(!['date','tax','paid'].includes(input.action))throw new Error('未知批次操作');
  if(input.action==='date'&&!dateFields.includes(input.dateField))throw new Error('不支援的日期欄位');
  if(input.action==='paid'&&!validDate(input.date))throw new Error('請填寫有效的實際繳納日期');
  if(!Array.isArray(input.entries)||!input.entries.length)throw new Error('請至少勾選一位客戶');
  const rows=copy(data.periodClients),seen=new Set(),changes=[];
  for(const entry of input.entries){
   if(seen.has(entry.pcId))throw new Error('每位客戶只能勾選一次');seen.add(entry.pcId);
   const next=rows.find(pc=>pc.id===entry.pcId),old=data.periodClients.find(pc=>pc.id===entry.pcId);
   if(!next||next.periodId!==period.id)throw new Error('請只選擇目前期別客戶');if(!eligible(next,input.action))throw new Error((next.snapshot?.name||'此客戶')+' 本期不適用、已繳納或沒有正數應繳稅額');
   if(input.action==='date'){
    if(!validDate(entry.value))throw new Error((next.snapshot?.name||'此客戶')+' 請填寫有效日期');
    if(next[input.dateField]===entry.value)continue;
    if(input.dateField==='appointmentDate'&&next.appointmentDate)next.scheduleHistory=(next.scheduleHistory||[]).concat({oldDate:next.appointmentDate,newDate:entry.value,changedAt:at,reason:'批次登記'});
    next[input.dateField]=entry.value;
   }else if(input.action==='tax'){
    const value=amount(entry.value);if(hasTax(next)&&amount(next.taxAmount)===value)continue;
    if(next.taxPaid)throw new Error((next.snapshot?.name||'此客戶')+' 已繳稅，請在個別明細核對繳納紀錄後調整稅額');
    next.taxAmount=value;
   }else{next.taxPaid=true;next.taxPaidDate=input.date;next.taxPaidAmount=amount(next.taxAmount);}
   next.updatedAt=at;changes.push({old:copy(old),next});
  }
  return {periodClients:rows,changes};
 }
 return {validDate,amount,hasTax,matches,eligible,plan,dateFields};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createVATBulkPolicy215};
