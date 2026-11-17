/* Batch edits use the existing per-period customer fields; blank is distinct from zero. */
function createVATBulkPolicy215(){
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x)),dateFields=['appointmentDate','plannedTaxPayDate'];
 function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000'))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value;}
 function amount(raw,label='稅額'){
  const text=String(raw??'').normalize('NFKC').trim();
  if(!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text))throw new Error(label+'請填有效數字，最多兩位小數');
  const negative=text.startsWith('-'),[whole,fraction='']=text.replace(/^-/,'').replace(/,/g,'').split('.'),cents=BigInt(whole)*100n+BigInt((fraction+'00').slice(0,2));
  if(cents>99999999999999n)throw new Error(label+'超出範圍');return (negative?-1:1)*Number(cents)/100;
 }
 function hasTax(pc){if(pc.taxAmount==null||String(pc.taxAmount).trim()==='')return false;try{amount(pc.taxAmount);return true}catch{return false}}
 function matches(pc,filters={}){
  const date=validDate(pc[filters.dateField||'appointmentDate']),tax=hasTax(pc);
  return (filters.date==='set'?date:filters.date==='missing'?!date:true)&&(filters.tax==='set'?tax:filters.tax==='missing'?!tax:true);
 }
 function eligible(pc,action){return !pc.notApplicable&&(action!=='paid'||hasTax(pc)&&amount(pc.taxAmount)>0&&!pc.taxPaid)}
 function priorCarry(pc,data){const ordered=data.periods.slice().sort((a,b)=>Number(a.year)-Number(b.year)||Number(a.slot)-Number(b.slot)),index=ordered.findIndex(p=>p.id===pc.periodId);if(pc.priorCarrySourcePCId218){const source=data.periodClients.find(x=>x.id===pc.priorCarrySourcePCId218),sourceIndex=ordered.findIndex(p=>p.id===source?.periodId);return !!source&&source.clientId===pc.clientId&&sourceIndex>=0&&sourceIndex<index&&!!source.carryInvoiceForward}const previous=ordered[index-1],candidates=previous?data.periodClients.filter(x=>x.periodId===previous.id&&x.clientId===pc.clientId):[];return candidates.length===1&&!!candidates[0].carryInvoiceForward}
 function boolean(value){if(value===true||value==='true')return true;if(value===false||value==='false')return false;throw new Error('請明確選擇是或否')}
 function text(value,max=12000){if(typeof value!=='string'||value.length>max)throw new Error('文字格式錯誤或超過 '+max+' 字');return value;}
 function noteValue(old,value,mode){if(mode==='clear')return '';const next=text(value);if(!next.trim())throw new Error('請輸入內容；需要清空時請選清空原文');if(mode==='append')return text(String(old||'')+(old?'\n':'')+next);if(mode==='replace')return next;throw new Error('請選擇追加、取代或清空');}
 function plan(input,data,at){
  const period=data.periods.find(p=>p.id===input.periodId);if(!period)throw new Error('期別已不存在');if(period.status==='已結束'&&!period.unlocked)throw new Error('此期已結束，請先解鎖');
  if(!['date','tax','paid','receipt','carry','payment','notes'].includes(input.action))throw new Error('未知批次操作');
  const fields={receipt:['receiptStatusId','appointmentDate','dispatchLeadDaysOverride','receiptNote'],carry:['carryInvoiceForward','priorCarryInvoiceHandled'],notes:['notes','caseClosed']};
  if(fields[input.action]&&!fields[input.action].includes(input.field))throw new Error('不支援的批次欄位');
  if(input.action==='date'&&!dateFields.includes(input.dateField))throw new Error('不支援的日期欄位');
  if(input.action==='paid'&&!validDate(input.date))throw new Error('請填寫有效的實際繳納日期');
  if(!Array.isArray(input.entries)||!input.entries.length)throw new Error('請至少勾選一位客戶');
  const rows=copy(data.periodClients),seen=new Set(),changes=[];
  for(const entry of input.entries){
   if(seen.has(entry.pcId))throw new Error('每位客戶只能勾選一次');seen.add(entry.pcId);
   const next=rows.find(pc=>pc.id===entry.pcId),old=data.periodClients.find(pc=>pc.id===entry.pcId);
   if(!next||next.periodId!==period.id)throw new Error('請只選擇目前期別客戶');if(!eligible(next,input.action))throw new Error((next.snapshot?.name||'此客戶')+' 本期不適用、已繳納或沒有正數應繳稅額');
   try{if(input.action==='date'){
    if(!validDate(entry.value))throw new Error((next.snapshot?.name||'此客戶')+' 請填寫有效日期');
    if(next[input.dateField]===entry.value)continue;
    if(input.dateField==='appointmentDate'&&next.appointmentDate)next.scheduleHistory=(next.scheduleHistory||[]).concat({oldDate:next.appointmentDate,newDate:entry.value,changedAt:at,reason:'批次登記'});
    next[input.dateField]=entry.value;
   }else if(input.action==='tax'){
    const value=amount(entry.value);if(hasTax(next)&&amount(next.taxAmount)===value)continue;
    if(next.taxPaid)throw new Error((next.snapshot?.name||'此客戶')+' 已繳稅，請在個別明細核對繳納紀錄後調整稅額');
    next.taxAmount=value;
   }else if(input.action==='paid'){next.taxPaid=true;next.taxPaidDate=input.date;next.taxPaidAmount=amount(next.taxAmount);}
   else if(input.action==='receipt'){
    const field=input.field;let value;
    if(field==='receiptStatusId'){
     value=entry.value;if(value===next.receiptStatusId)continue;
     const status=(data.receiptStatuses||[]).find(s=>s.id===value&&s.active!==false);if(!status)throw new Error('請選擇有效的收件狀態');
     const before=(data.receiptStatuses||[]).find(s=>s.id===next.receiptStatusId);next.receiptStatusHistory=(next.receiptStatusHistory||[]).concat({id:entry.historyId||'bulk-receipt-'+entry.pcId+'-'+at,oldStatus:before?.name||next.receiptStatusText||'未設定',newStatus:status.name,changedAt:at});
    }else if(field==='appointmentDate'){
     value=entry.value;if(!validDate(value))throw new Error('請填寫有效預約日期');if(next[field]===value)continue;
     if(next[field])next.scheduleHistory=(next.scheduleHistory||[]).concat({oldDate:next[field],newDate:value,changedAt:at,reason:'批次收發票'});
    }else if(field==='dispatchLeadDaysOverride'){
     const raw=String(entry.value??'').trim();if(raw!==''&&(!/^\d+$/.test(raw)||Number(raw)>3650))throw new Error('提前天數請填 0～3650 整數，空白沿用設定');value=raw===''?null:Number(raw);
    }else value=noteValue(next.receiptNote,entry.value,input.mode||'append');
    if(next[field]===value)continue;next[field]=value;
   }else if(input.action==='carry'){
    const value=boolean(entry.value);if(input.field==='priorCarryInvoiceHandled'&&value&&!priorCarry(next,data))throw new Error((next.snapshot?.name||'客戶')+' 上期沒有跨期發票，無法標記已處理');
    if(!!next[input.field]===value)continue;next[input.field]=value;
   }else if(input.action==='notes'){
    const value=input.field==='caseClosed'?boolean(entry.value):noteValue(next.notes,entry.value,input.mode||'append');if((input.field==='caseClosed'?!!next.caseClosed:next.notes||'')===value)continue;next[input.field]=value;
   }else if(input.action==='payment'){
    const value=amount(entry.value,'收款金額');if(value<=0)throw new Error('收款金額必須大於零');const date=entry.date||input.date;if(!validDate(date))throw new Error('請填寫有效收款日期');
    const id=entry.paymentId;if(typeof id!=='string'||!id||(rows.some(pc=>(pc.payments||[]).some(pay=>pay.id===id))))throw new Error('付款識別碼重複或無效');
    next.payments=(next.payments||[]).concat({id,date,amount:value,target:'auto',account:text(entry.account||'',200),note:text(entry.note||'',4000),createdAt:at,updatedAt:at});
   }
   next.updatedAt=at;changes.push({old:copy(old),next});
   }catch(error){error.pcId=entry.pcId;throw error;}
  }
  return {periodClients:rows,changes};
 }
 return {validDate,amount,hasTax,matches,eligible,plan,dateFields,priorCarry,boolean,noteValue};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createVATBulkPolicy215};
