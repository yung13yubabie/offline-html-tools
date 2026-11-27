/* Each record is one actual payment to one payee. Amounts use integer cents. */
function createLeaseWithholding238(){
 const dates=(typeof module!=='undefined'&&module.exports
  ?require('./cases-core.js').createCasesEngine219:createCasesEngine219)();
 const minDate='2021-01-01',standardMin=2_000_000,nhiCap=1_000_000_000,maxAmount=999_999_999_999;
 const residencies=['resident','nonresident'],nhiRules=['standard','exempt','special'];
 const money=value=>Number.isSafeInteger(value)&&value>=0&&value<=maxAmount;
 const specialMin=value=>money(value)&&value>=standardMin&&value<=nhiCap;
 const fail=message=>{throw Error(message);};
 const defaultPolicy=()=>({residency:'resident',nhiRule:'standard'});
 function policy(input=defaultPolicy()){
  if(!input||!residencies.includes(input.residency)||!nhiRules.includes(input.nhiRule))fail('的扣繳身分或健保條件無效');
  if(input.nhiRule==='special'&&!specialMin(input.nhiMin))fail('須填寫 20,000 元至 1,000 萬元的健保門檻');
  return {residency:input.residency,nhiRule:input.nhiRule,...(input.nhiRule==='special'?{nhiMin:input.nhiMin}:{})};
 }
 function normalize(rows=[]){
  if(!Array.isArray(rows)||rows.length>2400)fail('租金給付紀錄格式錯誤或超過 2,400 筆');
  const ids=new Set(),months=new Set();
  return rows.map((row,index)=>{
   const error=message=>fail('第 '+(index+1)+' 筆租金給付'+message);
   if(!row||typeof row.id!=='string'||!/^[-\w]{1,100}$/.test(row.id)||ids.has(row.id))error('編號無效或重複');
   ids.add(row.id);
   if(!dates.date(row.date)||row.date<minDate)error('日期須為 2021 年起的有效日期');
   if(!money(row.amount)||row.amount===0)error('應填寫大於 0 的給付總額');
   let terms;try{terms=policy(row);}catch(e){error(e.message);}
   if(row.rentMonth!==undefined){
    if(typeof row.rentMonth!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.rentMonth)||months.has(row.rentMonth))error('的月租月份無效或重複');
    months.add(row.rentMonth);
   }
   if(![row.taxActual,row.nhiActual].every(value=>value===null||money(value)))error('的實扣金額無效');
   if(typeof row.note!=='string'||row.note.length>240)error('的給付備註最多 240 字');
   const {id,date,amount,taxActual,nhiActual,note,rentMonth}=row;
   return {id,date,amount,...terms,taxActual,nhiActual,note:note.trim(),...(rentMonth===undefined?{}:{rentMonth})};
  });
 }
 function calculate({amount,residency,nhiRule,nhiMin}){
  const taxRate=residency==='nonresident'?20n:10n;
  const base=BigInt(amount)*taxRate;
  // Test the statutory exemption on the calculated amount before dropping fractions of a dollar.
  const tax=residency==='resident'&&base<=20_000_000n?0:Number(base/10_000n)*100;
  const threshold=nhiRule==='special'?nhiMin:standardMin;
  const nhi=nhiRule==='exempt'||amount<threshold?0:
   Number((BigInt(Math.min(amount,nhiCap))*211n+500_000n)/1_000_000n)*100;
  return {tax,nhi};
 }
 function reconcile(rows,changes,{fill=false}={}){
  return normalize(rows.map(row=>{
   if(!changes.has(row.id))return row;
   const actual=changes.get(row.id),expected=calculate(row);
   return {...row,taxActual:actual.taxActual??(fill?expected.tax:null),nhiActual:actual.nhiActual??(fill?expected.nhi:null)};
  }));
 }
 return {normalize,calculate,minDate,specialMin,policy,defaultPolicy,reconcile};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createLeaseWithholding238};
