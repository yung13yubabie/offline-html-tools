/* Each record is one actual payment to one payee. Amounts use integer cents. */
function createLeaseWithholding238(){
 const dates=(typeof module!=='undefined'&&module.exports
  ?require('./cases-core.js').createCasesEngine219:createCasesEngine219)();
 const minDate='2021-01-01',standardMin=2_000_000,nhiCap=1_000_000_000,maxAmount=999_999_999_999;
 const residencies=['resident','nonresident'],nhiRules=['standard','exempt','special'];
 const money=value=>Number.isSafeInteger(value)&&value>=0&&value<=maxAmount;
 const specialMin=value=>money(value)&&value>=standardMin&&value<=nhiCap;
 const fail=message=>{throw Error(message);};
 function normalize(rows=[]){
  if(!Array.isArray(rows)||rows.length>2400)fail('租金給付紀錄格式錯誤或超過 2,400 筆');
  const ids=new Set();
  return rows.map((row,index)=>{
   const error=message=>fail('第 '+(index+1)+' 筆租金給付'+message);
   if(!row||typeof row.id!=='string'||!/^[-\w]{1,100}$/.test(row.id)||ids.has(row.id))error('編號無效或重複');
   ids.add(row.id);
   if(!dates.date(row.date)||row.date<minDate)error('日期須為 2021 年起的有效日期');
   if(!money(row.amount)||row.amount===0)error('應填寫大於 0 的給付總額');
   if(!residencies.includes(row.residency)||!nhiRules.includes(row.nhiRule))error('的扣繳身分或健保條件無效');
   if(row.nhiRule==='special'&&!specialMin(row.nhiMin))error('須填寫 20,000 元至 1,000 萬元的健保門檻');
   if(![row.taxActual,row.nhiActual].every(value=>value===null||money(value)))error('的實扣金額無效');
   if(typeof row.note!=='string'||row.note.length>240)error('的給付備註最多 240 字');
   const {id,date,amount,residency,nhiRule,taxActual,nhiActual,note}=row;
   return {id,date,amount,residency,nhiRule,...(nhiRule==='special'?{nhiMin:row.nhiMin}:{}),taxActual,nhiActual,note:note.trim()};
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
 return {normalize,calculate,minDate,specialMin};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createLeaseWithholding238};
