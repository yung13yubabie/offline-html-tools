/* Tax workspace policy: view numbering and per-row exempt sales are separate from normal tax arithmetic. */
function createTaxWorkspacePolicy(){
 'use strict';
 const order={sales:['salesTriple','salesElectronic','salesTwo','salesReturn','salesZero','salesExempt'],input:['inputReceipt','inputForeign','inputTaxed','inputCustoms','inputReturn']};
 const eligible=['salesTriple','salesTwo'];
 function number(id){for(const ids of Object.values(order)){const n=ids.indexOf(id);if(n>=0)return n+1}throw new Error('未知發票類型')}
 function code(id,book){if(!Number.isSafeInteger(Number(book))||Number(book)<1)throw new Error('冊別編號錯誤');return number(id)+'-'+Number(book)}
 function parse(raw){const text=String(raw??'').normalize('NFKC').trim();if(!text)return {blank:true,cents:0,value:0};
  if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text))throw new Error('請填 0 以上金額，最多兩位小數');
  const [whole,fraction='']=text.replace(/,/g,'').split('.'),n=BigInt(whole)*100n+BigInt((fraction+'00').slice(0,2));
  if(n>99999999999999n)throw new Error('金額超出範圍');const cents=Number(n);return {blank:false,cents,value:cents/100};
 }
 function sum(values){let cents=0;for(const value of values){cents+=parse(value).cents;if(!Number.isSafeInteger(cents))throw new Error('免稅合計超出範圍')}return cents/100}
 function exemptAmounts(id,raw){if(!eligible.includes(id))throw new Error('此發票類型不適用清空稅額轉免稅');const input=parse(raw);if(input.blank)return null;const amount=Math.trunc(input.value);return {amount,net:amount,tax:0,gross:amount};}
 function format(value){return new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value)}
 function reviewLayout(count,width,height,rowHeight=44){
  const rows=Math.max(1,Math.floor((Math.max(0,height)-36)/Math.max(44,rowHeight)));
  const columns=width>=850&&count>rows?2:1;
  return {rows,columns,pageSize:rows*columns,pages:Math.max(1,Math.ceil(count/(rows*columns)))};
 }
 return {order,eligible,number,code,parse,sum,format,exemptAmounts,reviewLayout};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createTaxWorkspacePolicy};
