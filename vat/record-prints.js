const recordPrints232={
 cases:{
  title:'案件進度清單',
  headings:['代號','客戶','案件名稱','狀態','開始日期','截止日期','目前進度','進度日期'],
  rows:()=>{
   const engine=caseEngine219();
   return (state.cases||[]).map(record=>{
    const progress=engine.progressInOrder(record).at(-1);
    return {record,date:record.dueDate||record.startDate,values:[
     record.title,CASE_STATUS219[record.status],fmtDate(record.startDate),
     record.dueDate?[fmtDate(record.dueDate),record.dueTime].filter(Boolean).join(' '):'—',
     progress?.stage||'—',progress?fmtDate(progress.date):'—'
    ]};
   });
  }
 },
 contracts:{
  title:'租約與合約清單',
  headings:['代號','客戶','合約名稱','類別','狀態','開始日期','到期日期','月租金額','押金金額'],
  rows:()=>{
   const records=contracts220(),successors=contractEngine220.successors(records),today=localDate();
   return records.map(record=>({record,date:record.endDate,values:[
    record.title,contractTypeName220(record.categoryId),
    contractStatus220[contractEngine220.status(record,today,successors.has(record.id))][0],
    record.startDate?fmtDate(record.startDate):'—',fmtDate(record.endDate),
    record.lease?.steps.length?leaseRentDisplay225(record,today).value:'—',
    record.lease?.deposit!=null?leaseMoney224(record.lease.deposit):'—'
   ]}));
  }
 }
};
const isRecordPrint232=scope=>Object.hasOwn(recordPrints232,scope);
for(const {headings} of Object.values(recordPrints232))for(const label of headings)PDF_LAYOUT_KNOWN_KEYS212.add('c:'+label);

function recordPrintPages232(scope,clientId,orientation){
 const {title,headings,rows}=recordPrints232[scope];
 const records=rows().filter(({record})=>!clientId||record.clientId===clientId)
  .sort((a,b)=>a.date.localeCompare(b.date)||a.record.title.localeCompare(b.record.title,'zh-Hant')||a.record.id.localeCompare(b.record.id));
 const pageSize=orientation==='landscape'?12:16,total=Math.max(1,Math.ceil(records.length/pageSize));
 const heading=headings.map(label=>`<th>${esc(label)}</th>`).join('');
 return Array.from({length:total},(_,index)=>{
  const page=index+1;
  const body=records.slice(index*pageSize,page*pageSize).map(({record,values})=>{
   const client=clientById(record.clientId);
   return `<tr class="pdf-row">${[client?.code||'—',client?.name||'—',...values].map(value=>`<td>${esc(value)}</td>`).join('')}</tr>`;
  }).join('')||`<tr><td colspan="${headings.length}">沒有符合條件的資料</td></tr>`;
  return `<div class="pdf-page">
   <div class="pdf-head pdf-head-balanced"><div class="pdf-title">${esc(title)}</div>
   <div class="pdf-head-meta"><div class="pdf-meta-item"><span class="pdf-meta-label">匯出日期</span><span class="pdf-meta-value">${esc(fmtDate(localDate()))}</span></div>
   <div class="pdf-meta-item"><span class="pdf-meta-label">筆數</span><span class="pdf-meta-value">${records.length}</span></div></div></div>
   <table class="pdf-table compact"><thead><tr>${heading}</tr></thead><tbody>${body}</tbody></table>
   <div class="pdf-foot"><span>${esc(title)}</span><span>${page} / ${total}</span></div></div>`;
 }).join('');
}
