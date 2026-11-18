/* Exact date-range allocation. Pure civil dates and integer cents; no locale or time-zone dependency. */
function createAllocationCore19(){
 'use strict';
 const DAY_MS=86400000,MAX_CENTS=99999999999999n;
 function invalid(field,message){const error=new Error(message);error.field=field;throw error;}
 function parseAmount(raw){
  const value=typeof raw==='string'?raw.trim():typeof raw==='number'&&Number.isFinite(raw)?String(raw):'';
  if(!value)invalid('amount','請填入整段期間的總金額。');
  if(value.length>40)invalid('amount','總金額超出範圍，最多 999,999,999,999.99。');
  if(!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value))invalid('amount','金額請填數字，最多兩位小數；千分位須如 1,234.56。');
  const negative=value[0]==='-',text=value.replace(/^-/,'').replace(/,/g,''),[whole,fraction='']=text.split('.'),cents=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  if(cents>MAX_CENTS)invalid('amount','總金額超出範圍，最多 999,999,999,999.99。');
  return negative&&cents!==0n?-cents:cents;
 }
 function parseDate(raw,field='date'){
  const value=typeof raw==='string'?raw.trim():'';
  if(!value)invalid(field,field==='start'?'請填起始日期。':field==='end'?'請填結束日期。':'請填日期。');
  const separated=/^(\d{4})([-/])(\d{1,2})\2(\d{1,2})$/.exec(value);
  const compact=/^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if(!separated&&!compact)invalid(field,'請輸入 YYYY/MM/DD、YYYY-MM-DD 或 YYYYMMDD。');
  const [year,month,day]=(separated?[separated[1],separated[3],separated[4]]:compact.slice(1)).map(Number);
  if(year<1||year>9999)invalid(field,'年份須介於 0001 至 9999。');
  const date=new Date(0);date.setUTCHours(0,0,0,0);date.setUTCFullYear(year,month-1,day);
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)invalid(field,'日期不存在，請檢查月份、天數及閏年。');
  return {year,month,day,ordinal:date.getTime()/DAY_MS,text:String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0')};
 }
 function civilOrdinal(year,month,day){const date=new Date(0);date.setUTCHours(0,0,0,0);date.setUTCFullYear(year,month-1,day);return date.getTime()/DAY_MS;}
 function dateText(ordinal){const date=new Date(ordinal*DAY_MS);return String(date.getUTCFullYear()).padStart(4,'0')+'-'+String(date.getUTCMonth()+1).padStart(2,'0')+'-'+String(date.getUTCDate()).padStart(2,'0');}
 function monthDays(year,month){return month===2?(year%4===0&&(year%100!==0||year%400===0)?29:28):[4,6,9,11].includes(month)?30:31;}
 function allocate(options={}){
  const {amount,start,end,unit='year'}=options,amountCents=parseAmount(amount),first=parseDate(start,'start'),last=parseDate(end,'end');
  if(unit!=='year'&&unit!=='month')invalid('unit','請選擇按年或按月分攤。');
  if(last.ordinal<first.ordinal)invalid('end','結束日期不能早於起始日期。');
  const totalDays=last.ordinal-first.ordinal+1,denominator=BigInt(totalDays),negative=amountCents<0n,absolute=negative?-amountCents:amountCents,rows=[];
  let current=first.ordinal,baseSum=0n;
  while(current<=last.ordinal){const date=new Date(current*DAY_MS),year=date.getUTCFullYear(),month=date.getUTCMonth()+1,groupEnd=unit==='year'?civilOrdinal(year,12,31):civilOrdinal(year,month,monthDays(year,month)),endOrdinal=Math.min(groupEnd,last.ordinal),days=endOrdinal-current+1,numerator=absolute*BigInt(days),base=numerator/denominator,key=String(year).padStart(4,'0')+(unit==='month'?'-'+String(month).padStart(2,'0'):'');
   rows.push({key,label:String(year).padStart(4,'0')+' 年'+(unit==='month'?' '+String(month).padStart(2,'0')+' 月':''),start:dateText(current),end:dateText(endOrdinal),days,cents:base,baseCents:base,remainder:numerator%denominator});baseSum+=base;current=endOrdinal+1;
  }
  const remaining=Number(absolute-baseSum);
  if(remaining){const order=rows.map((row,index)=>({index,remainder:row.remainder})).sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1);for(let i=0;i<remaining;i++)rows[order[i].index].cents+=1n;}
  for(const row of rows){row.adjusted=row.cents!==row.baseCents;if(negative){row.cents=-row.cents;row.baseCents=-row.baseCents;}}
  return {amountCents,totalDays,unit,start:first.text,end:last.text,rows};
 }
 function formatCents(cents,{trim=false}={}){if(typeof cents!=='bigint')invalid('amount','金額單位須為整數分。');const negative=cents<0n,absolute=negative?-cents:cents,whole=(absolute/100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,','),fraction=(absolute%100n).toString().padStart(2,'0');return (negative?'-':'')+whole+(trim&&fraction==='00'?'':'.'+fraction);}
 function displayOptions(options={}){const out={};for(const key of ['amount','ratio','dates','result']){if(options[key]!=null&&typeof options[key]!=='boolean')invalid('options','顯示項目須為勾選狀態。');out[key]=options[key]==null?key==='amount'||key==='ratio':options[key];}return out;}
 function expression(data,row,options={}){const show=displayOptions(options),parts=[];if(show.amount)parts.push(formatCents(data.amountCents,{trim:true}));if(show.ratio)parts.push(row.days+'/'+data.totalDays);let out=parts.join(' × ');if(show.result){const result=formatCents(row.cents);out=out?out+(show.amount&&show.ratio?' = ':' → ')+result:result;}return out;}
 function formatLine(data,row,options={}){const show=displayOptions(options),parts=[expression(data,row,show)];if(show.dates)parts.push(row.start+' ～ '+row.end);const body=parts.filter(Boolean).join('｜');return body?row.label+'｜'+body:'';}
 function plaintext(data,options={}){const show=displayOptions(options);if(!Object.values(show).some(Boolean))return '';return data.rows.map(row=>formatLine(data,row,show)).join('\n');}
 return Object.freeze({MAX_CENTS,parseAmount,parseDate,allocate,formatCents,expression,formatLine,plaintext,displayOptions});
}
if(typeof module!=='undefined'&&module.exports)module.exports={createAllocationCore19};
