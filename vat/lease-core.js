/* Lease amounts are integer cents, and percentage rates use four decimal places. */
function createLeaseEngine224() {
 const date=(typeof module!=='undefined'&&module.exports
  ?require('./cases-core.js').createCasesEngine219:createCasesEngine219)().date;
 const frequencies=[1,2,3,12],statuses=['pending','missing','issued'],scale=1000000n;
 const maxCents=999999999999;
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
   const fullMonths=months.filter(month=>month.begin===month.start&&month.finish===month.end).length;
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
  if(basis!==lease.rentBasis&&lease.checks.some(check=>check.rentActual!==null)){
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
 function normalize(raw,start,end){
  if(!raw||raw.version!==1||!frequencies.includes(raw.frequency)||!['net','gross'].includes(raw.rentBasis)||
    !['invoice','assessed'].includes(raw.regime)||!valid(raw.vatRate,Number(scale))||
    !(raw.deposit===null||valid(raw.deposit))||!Array.isArray(raw.steps)||raw.steps.length>120||!Array.isArray(raw.checks))fail('租約費用資料格式錯誤');
  const ranges=new Map(periods(start,end,raw.frequency).map(row=>[row.key,row]));
  const steps=raw.steps.map(step=>{
   if(!step||!date(step.from)||step.from<start||step.from>end||!valid(step.cents))fail('請核對租金階段的生效日與月租');
   return {from:step.from,cents:step.cents};
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
  return {version:1,frequency:raw.frequency,rentBasis:raw.rentBasis,deposit:raw.deposit,regime:raw.regime,vatRate:raw.vatRate,steps,checks};
 }
 const round=(numerator,denominator)=>Number((numerator+denominator/2n)/denominator);
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
 function calculate(record,rates){
  if(!record.lease)return [];
  const lease=record.lease,rateMap=new Map(rates.map(row=>[row.id,row.rate]));
  const checks=new Map(lease.checks.map(row=>[row.key,row]));
  return periods(record.startDate,record.endDate,lease.frequency).map(period=>{
   const check=checks.get(period.key)||emptyCheck(period.key);
   const monthlyRent=lease.steps.length?period.months.map(month=>rentForMonth(month,lease.steps)):[];
   const rent=monthlyRent.length?monthlyRent.reduce((sum,cents)=>sum+cents,0):null;
   const annual=rateMap.get(period.year)??null,months=check.interestMonths??period.fullMonths;
   const {gross,interest,needsRate}=interestAmounts({...lease,annual,months});
   const rentResult=compare(rent,check.rentStatus,check.rentActual);
   const interestResult=compare(interest,check.interestStatus,check.interestActual);
   return {...period,check,rent,monthlyRent,interest,gross,annual,interestMonths:months,needsRate,rentResult,interestResult};
  });
 }
 return {amount,rate,format,frequencies,defaultLease,updateOpeningRent,updateDeposit,validateRates,normalize,periods,emptyCheck,interestAmounts,calculate};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createLeaseEngine224};
