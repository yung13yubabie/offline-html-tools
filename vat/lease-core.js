/* Lease amounts are integer cents, and percentage rates use four decimal places. */
function createLeaseEngine224() {
 const {date,iso}=(typeof module!=='undefined'&&module.exports
  ?require('./cases-core.js').createCasesEngine219:createCasesEngine219)();
 const frequencies=[1,2,3,12],statuses=['pending','missing','issued'],scale=1000000n;
 const maxCents=999999999999;
 const defaultRentTaxRate=50000;
 const fail=message=>{throw Error(message);};
 function decimal(value,places,max){
  const raw=String(value??'').normalize('NFKC').trim();
  if(!raw)return null;
  if(!new RegExp('^(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\\.[0-9]{1,'+places+'})?$').test(raw))fail('金額或利率格式有誤');
  const [whole,fraction='']=raw.replaceAll(',','').split('.');
  const units=Number(whole+fraction.padEnd(places,'0'));
  if(!Number.isSafeInteger(units)||units>max)fail('金額或利率超出範圍');
  return units;
 }
 function valid(value,max=maxCents){
  return Number.isSafeInteger(value)&&value>=0&&value<=max;
 }
 const amount=value=>decimal(value,2,maxCents);
 const rate=value=>decimal(value,4,Number(scale));
 const defaultRentReminderDays=30;
 function rentReminderDays(raw=defaultRentReminderDays){
  if(raw===null)return null;
  if(typeof raw==='string'&&/^\d{1,3}$/.test(raw))raw=Number(raw);
  if(!valid(raw,365))fail('調租提醒請輸入 0 至 365 天的整數');
  return raw;
 }
 function rentChanges(lease){
  const steps=(lease?.steps||[]).slice().sort((a,b)=>a.from.localeCompare(b.from));
  return steps.slice(1).flatMap((step,index)=>{
   const before=steps[index].cents,difference=step.cents-before;
   return difference?[{date:step.from,before,after:step.cents,difference,
    remindDays:rentReminderDays(step.remindDays),doneAt:step.reminderDoneAt||''}]:[];
  });
 }
 function carryRentConfirmations(previous,next){
  const old=new Map(rentChanges(previous).map(change=>[change.date,change]));
  const confirmed=new Map();
  if(previous?.rentBasis===next.rentBasis){
   for(const change of rentChanges(next)){
    const before=old.get(change.date);
    if(before?.doneAt&&before.before===change.before&&before.after===change.after&&before.remindDays===change.remindDays){
     confirmed.set(change.date,before.doneAt);
    }
   }
  }
  return {...next,steps:next.steps.map(({reminderDoneAt,...step})=>{
   const doneAt=confirmed.get(step.from);
   return doneAt?{...step,reminderDoneAt:doneAt}:step;
  })};
 }
 const format=(units,places=2)=>{
  if(units==null)return '';
  const sign=units<0?'−':'',digits=String(Math.abs(units)).padStart(places+1,'0');
  const fraction=digits.slice(-places).replace(/0+$/,'');
  return sign+digits.slice(0,-places)+(fraction?'.'+fraction:'');
 };
 const defaultLease=()=>({version:1,frequency:2,rentBasis:'net',deposit:null,regime:'invoice',vatRate:50000,steps:[],checks:[]});
 function validateRates(rows=[]){
  if(!Array.isArray(rows))fail('郵政利率資料格式錯誤');
  const years=new Set();
  for(const row of rows){
   if(!row||typeof row.id!=='string'||!/^\d{4}$/.test(row.id)||row.id==='0000'||!valid(row.rate,Number(scale))||years.has(row.id))fail('郵政年度利率無效或重複');
   years.add(row.id);
  }
 }
 function monthIndex(value){return Number(value.slice(0,4))*12+Number(value.slice(5,7))-1;}
 function monthStart(index){return String(Math.floor(index/12)).padStart(4,'0')+'-'+String(index%12+1).padStart(2,'0')+'-01';}
 function monthEnd(index){
  const year=Math.floor(index/12),month=index%12+1;
  const leap=year%4===0&&(year%100!==0||year%400===0);
  return monthStart(index).slice(0,8)+[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
 }
 const fullMonth=month=>month.begin===month.start&&month.finish===month.end;
 function periods(start,end,frequency){
  if(!date(start)||!date(end)||start>end||!frequencies.includes(frequency))fail('請設定有效的租期起訖日與核對週期');
  const first=monthIndex(start),last=monthIndex(end),rows=[];
  if(last-first>=1200)fail('費用核對區間最多 100 年');
  for(let block=first-first%frequency;block<=last;block+=frequency){
   const from=Math.max(first,block),to=Math.min(last,block+frequency-1);
   const months=Array.from({length:to-from+1},(_,i)=>{
    const index=from+i,begin=monthStart(index),finish=monthEnd(index);
    return {begin,finish,start:begin<start?start:begin,end:finish>end?end:finish};
   });
   const periodStart=months[0].start,periodEnd=months.at(-1).end;
   const fullMonths=months.filter(fullMonth).length;
   rows.push({key:periodStart+'/'+periodEnd,start:periodStart,end:periodEnd,year:periodStart.slice(0,4),months,fullMonths});
  }
  return rows;
 }
 const inputError=(field,message)=>{throw Object.assign(new Error(message),{field});};
 function updateOpeningRent(current,start,value,basis){
  let cents;
  try{cents=amount(value);}
  catch{inputError('monthlyRent','請輸入有效的月租金額，最多兩位小數');}
  if(!current&&cents===null)return undefined;
  const lease=current||defaultLease(),later=lease.steps.slice(1);
  if(cents===null&&later.length)inputError('monthlyRent','請填寫首段月租');
  if(cents!==null&&!date(start))inputError('startDate','填寫月租時請一併設定租約開始日');
  if(cents!==null&&later.length&&start>=later[0].from)inputError('startDate','開始日須早於後續調租日期');
  if(basis!==lease.rentBasis&&hasRentActual(lease)){
   inputError('rentBasis','請先清除已登記的實開租金，再變更含稅／未稅基準');
  }
  return {...lease,rentBasis:basis,steps:cents===null?[]:[{from:start,cents},...later]};
 }
 function updateDeposit(current,start,value){
  let deposit;
  try{deposit=amount(value);}
  catch{inputError('deposit','請輸入有效的押金本金，最多兩位小數');}
  if(deposit!==null&&!date(start))inputError('startDate','填寫押金時請一併設定租約開始日');
  if(!current&&deposit===null)return undefined;
  return {...(current||defaultLease()),deposit};
 }
 function emptyCheck(key){
  return {key,rentStatus:'pending',rentActual:null,interestStatus:'pending',interestActual:null,interestMonths:null};
 }
 const monthKey=month=>month.start+'/'+month.end;
 const hasRentActual=lease=>lease.checks.some(check=>check.rentActual!==null)||(lease.rentMonths||[]).some(month=>month.actual!==null);
 function normalizeMonthChecks(raw,ranges,label,validate){
  if(raw===undefined)return [];
  if(!Array.isArray(raw)||raw.length>1200)fail('逐月'+label+'紀錄格式錯誤');
  const months=new Map([...ranges.values()].flatMap(period=>period.months.map(month=>[monthKey(month),month]))),seen=new Set();
  return raw.map(row=>{
   const month=months.get(row?.key);
   if(!month||seen.has(row.key))fail('此變更會使單月'+label+'紀錄失去對應，請先處理該月核對');
   seen.add(row.key);
   return validate(row,month);
  }).filter(Boolean).sort((a,b)=>a.key.localeCompare(b.key));
 }
 function normalize(raw,start,end){
  if(!raw||raw.version!==1||!frequencies.includes(raw.frequency)||!['net','gross'].includes(raw.rentBasis)||
    !['invoice','assessed'].includes(raw.regime)||!valid(raw.vatRate,Number(scale))||
    !(raw.deposit===null||valid(raw.deposit))||!Array.isArray(raw.steps)||raw.steps.length>120||!Array.isArray(raw.checks)||
    (raw.rentVatRate!==undefined&&!valid(raw.rentVatRate,Number(scale))))fail('租約費用資料格式錯誤');
  const ranges=new Map(periods(start,end,raw.frequency).map(row=>[row.key,row]));
  const steps=raw.steps.map(step=>{
   if(!step||!date(step.from)||step.from<start||step.from>end||!valid(step.cents))fail('請核對租金階段的生效日與月租');
   const remindDays=rentReminderDays(step.remindDays);
   const doneAt=step.reminderDoneAt;
   if(doneAt!==undefined&&(!iso(doneAt)||remindDays===null||step.from===start))fail('調租提醒確認時間無效');
   return {from:step.from,cents:step.cents,...(step.from!==start&&remindDays!==defaultRentReminderDays?{remindDays}:{}),
    ...(doneAt?{reminderDoneAt:doneAt}:{})};
  }).sort((a,b)=>a.from.localeCompare(b.from));
  if(steps.length&&steps[0].from!==start)fail('第一階段租金須從租約開始日生效');
  if(new Set(steps.map(step=>step.from)).size!==steps.length)fail('租金階段的生效日重複');
  const seen=new Set();
  const checks=raw.checks.map(check=>{
   const period=ranges.get(check?.key);
   if(!period||seen.has(check.key))fail('此變更會使已登記的核對期間失去對應，請先處理該期核對');
   seen.add(check.key);
   const row=emptyCheck(check.key);
   for(const key of ['rent','interest']){
    const status=check[key+'Status'],actual=check[key+'Actual'];
    if(!statuses.includes(status)||!(actual===null||valid(actual))||(status!=='issued'&&actual!==null))fail('請核對發票狀態與實際金額');
    row[key+'Status']=status;row[key+'Actual']=actual;
   }
   if(check.interestMonths!==null&&!valid(check.interestMonths,period.months.length))fail('押息月數不可超過本期涵蓋月數');
   row.interestMonths=check.interestMonths;
   return row;
  }).filter(check=>Object.entries(check).some(([key,value])=>key!=='key'&&value!=='pending'&&value!==null));
  const rentMonths=normalizeMonthChecks(raw.rentMonths,ranges,'租金',row=>{
   if(!['issued','missing'].includes(row.status)||!['net','gross'].includes(row.basis)||
    (row.status==='issued'?!valid(row.actual):row.actual!==null))fail('請核對單月發票狀態與金額');
   return {key:row.key,status:row.status,actual:row.actual,basis:row.basis};
  });
  const interestChecks=normalizeMonthChecks(raw.interestChecks,ranges,'押息',(row,month)=>{
   if(typeof row.charged!=='boolean'||!statuses.includes(row.status)||
    (row.actual!==null&&(row.status!=='issued'||!valid(row.actual))))fail('請核對單月押息的計息、發票狀態與金額');
   return row.status==='pending'&&row.charged===fullMonth(month)?null:
    {key:row.key,charged:row.charged,status:row.status,actual:row.actual};
  });
  return {version:1,frequency:raw.frequency,rentBasis:raw.rentBasis,deposit:raw.deposit,regime:raw.regime,vatRate:raw.vatRate,steps,checks,
   ...(raw.rentVatRate!==undefined&&raw.rentVatRate!==defaultRentTaxRate?{rentVatRate:raw.rentVatRate}:{}),
   ...(rentMonths.length?{rentMonths}:{}),...(interestChecks.length?{interestChecks}:{})};
 }
 const round=(numerator,denominator)=>Number((numerator+denominator/2n)/denominator);
 function convertRent(cents,from,to,vatRate=defaultRentTaxRate){
  if(cents===null||from===to)return cents;
  const factor=scale+BigInt(vatRate),amount=BigInt(Math.abs(cents)),sign=Math.sign(cents);
  return sign*(from==='gross'?round(amount*scale,factor):round(amount*factor,scale));
 }
 const day=value=>Number(value.slice(-2));
 function rentForMonth(month,steps){
  const start=day(month.start),end=day(month.end);
  let centsDays=0n;
  for(let i=0;i<steps.length;i++){
   const step=steps[i],next=steps[i+1];
   if(step.from>month.end)break;
   if(next&&next.from<=month.start)continue;
   const from=step.from<=month.start?start:day(step.from);
   const to=!next||next.from>month.end?end:day(next.from)-1;
   centsDays+=BigInt(step.cents)*BigInt(to-from+1);
  }
  return round(centsDays,BigInt(day(month.finish)));
 }
 function compare(expected,status,actual){
  if(status==='missing')return expected===0?'matched':'missing';
  if(expected===null)return 'unknown';
  if(status==='pending'||actual===null)return 'pending';
  return expected===actual?'matched':'different';
 }
 function interestAmounts({deposit,annual,months,regime,vatRate}){
  const needsRate=deposit>0&&months>0&&annual===null;
  if(needsRate||deposit===null)return {gross:null,interest:null,needsRate};
  const raw=BigInt(deposit)*BigInt(annual??0)*BigInt(months);
  const gross=round(raw,12n*scale);
  return {gross,interest:regime==='invoice'?round(raw,12n*(scale+BigInt(vatRate))):gross,needsRate};
 }
 const monthlyInterestAmounts=values=>interestAmounts({...values,months:1});
 const checkOutcome=outcomes=>['missing','different','unknown','pending'].find(key=>outcomes.includes(key))||'matched';
 function calculate(record,rates){
  if(!record.lease)return [];
  const lease=record.lease,rateMap=new Map(rates.map(row=>[row.id,row.rate]));
  const checks=new Map(lease.checks.map(row=>[row.key,row]));
  const rentChecks=new Map((lease.rentMonths||[]).map(row=>[row.key,row]));
  const interestChecks=new Map((lease.interestChecks||[]).map(row=>[row.key,row]));
  return periods(record.startDate,record.endDate,lease.frequency).map(period=>{
   const check=checks.get(period.key)||emptyCheck(period.key);
   const monthlyRent=lease.steps.length?period.months.map(month=>rentForMonth(month,lease.steps)):[];
   const rent=monthlyRent.length?monthlyRent.reduce((sum,cents)=>sum+cents,0):null;
   const annual=rateMap.get(period.year)??null,months=check.interestMonths??period.fullMonths;
   const {gross,interest,needsRate}=interestAmounts({...lease,annual,months});
   const monthlyInterest=monthlyInterestAmounts({...lease,annual});
   const noInterest=interestAmounts({...lease,annual,months:0});
   const interestRows=period.months.map(month=>{
    const key=monthKey(month),entry=interestChecks.get(key),charged=entry?.charged??fullMonth(month);
    const amounts=charged?monthlyInterest:noInterest;
    const actual=entry?.actual??null,status=entry?.status??'pending';
    const result=!charged&&status==='pending'?'matched':compare(amounts.interest,status,actual);
    return {...month,key,charged,actual,status,result,...amounts};
   });
   const hasMonthlyInterest=interestRows.some(row=>interestChecks.has(row.key));
   const hasLegacyInterest=check.interestStatus!=='pending'||check.interestActual!==null||check.interestMonths!==null;
   const interestSalesTotal=interestRows.some(row=>row.interest===null)?null:interestRows.reduce((sum,row)=>sum+row.interest,0);
   const rentRows=period.months.map((month,index)=>{
    const key=monthKey(month),entry=rentChecks.get(key),base=monthlyRent[index]??null;
    const basis=entry?.basis??lease.rentBasis,actual=entry?.actual??null,status=entry?.status??'pending';
    const expected=convertRent(base,lease.rentBasis,basis,lease.rentVatRate);
    return {...month,key,base,expected,basis,actual,status,result:compare(expected,status,actual)};
   });
   const hasMonthlyRent=rentRows.some(row=>row.status!=='pending');
   const legacyRentResult=compare(rent,check.rentStatus,check.rentActual);
   const rentResult=hasMonthlyRent?checkOutcome(rentRows.map(row=>row.result)):legacyRentResult;
   const legacyInterestResult=compare(interest,check.interestStatus,check.interestActual);
   const interestResult=hasLegacyInterest&&!hasMonthlyInterest?legacyInterestResult:checkOutcome(interestRows.map(row=>row.result));
   return {...period,check,rent,monthlyRent,rentRows,hasMonthlyRent,legacyRentResult,interest,gross,annual,interestMonths:months,
    needsRate,rentResult,interestResult,monthlyInterest,interestRows,interestSalesTotal,hasMonthlyInterest,hasLegacyInterest,legacyInterestResult};
  });
 }
 return {amount,rate,format,frequencies,defaultLease,updateOpeningRent,updateDeposit,validateRates,normalize,periods,emptyCheck,interestAmounts,calculate,
  defaultRentReminderDays,rentReminderDays,rentChanges,carryRentConfirmations,defaultRentTaxRate,convertRent,hasRentActual,monthlyInterestAmounts};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createLeaseEngine224};
