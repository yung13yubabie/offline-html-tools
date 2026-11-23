/* Synthetic fixtures are written only to the current tab's sample database. */
const vatSampleViews={
 today:'今日待辦',calendar:'日曆記事',cases:'案件',contracts:'租約與合約',work:'本期工作',
 accounting:'帳務處理',clients:'客戶庫',templates:'通知／模板',pdf:'列印編輯',backup:'備份／匯入',settings:'設定'
};
const vatSampleView=Object.hasOwn(vatSampleViews,vatSampleQuery.get('vatView'))?vatSampleQuery.get('vatView'):'';
function vatSampleURL(tier,view){
 const url=new URL(location.href);
 const params=new URLSearchParams({vatView:view});
 if(tier)params.set('vatSample',tier);
 url.hash=params.toString();
 return url.href;
}
function reloadVatSample(tier){
 history.replaceState(null,'',vatSampleURL(tier,state.view));
 location.reload();
}
function chooseVatSamples(){
 const name=vatSampleViews[state.view];
 const choices=Object.entries(vatSampleTiers).map(([tier,{label,clients}])=>`
  <a class="vat-sample-choice" data-vat-sample-choice="${tier}" href="${esc(vatSampleURL(tier,state.view))}" ${vatSampleTier?'':'target="_blank" rel="noopener"'}>
   <strong>${label}</strong><span>${clients} 位客戶</span>
  </a>`).join('');
 showModal('測試樣本',`<div class="vat-sample-picker"><p>${esc(name)} · 獨立測試資料</p>
  <div class="vat-sample-choices">${choices}</div>
  <p class="muted small">${vatSampleTier?'切換份量會重新填入樣本。':'樣本會在新分頁開啟。'}</p></div>`,[{text:'關閉',value:false}],()=>{});
 const links=$$('[data-vat-sample-choice]');
 for(const link of links)link.onclick=event=>{
  if(vatSampleTier){event.preventDefault();reloadVatSample(link.dataset.vatSampleChoice);}
  else setTimeout(()=>$('#modalRoot [data-close]')?.click(),0);
 };
 links[0]?.focus();
}
let vatSampleLoading=!!vatSampleTier;
const vatSampleBar=document.createElement('div');
vatSampleBar.className='vat-sample-bar';
if(vatSampleTier){
 const {label,clients}=vatSampleTiers[vatSampleTier];
 vatSampleBar.innerHTML=`<span class="badge b-orange" id="vatSampleIndicator">樣本模式 · ${label} · ${clients} 位</span>
  <button class="btn small" type="button" id="vatSampleLaunch">切換樣本量</button>
  <button class="btn small" type="button" id="vatSampleExit">返回正式資料</button>`;
 vatSampleBar.querySelector('#vatSampleExit').onclick=()=>reloadVatSample('');
}else vatSampleBar.innerHTML='<button class="btn small" type="button" id="vatSampleLaunch">測試樣本</button>';
vatSampleBar.querySelector('#vatSampleLaunch').onclick=chooseVatSamples;
function mountVatSampleBar(){
 const view=$('#view-'+state.view);
 if(!view)return;
 const header=view.querySelector('.page-head');
 if(header){
  if(vatSampleBar.parentNode!==header)header.append(vatSampleBar);
 }else if(vatSampleBar.parentNode!==view)view.prepend(vatSampleBar);
}
function showVatSampleLoading(){
 const app=$('.app');
 app.inert=true;
 app.classList.add('vat-sample-loading');
 app.insertAdjacentHTML('afterend',`<div class="vat-sample-progress" role="status"><strong>正在載入${vatSampleTiers[vatSampleTier].label}樣本</strong><span>${vatSampleTiers[vatSampleTier].clients} 位客戶與關聯紀錄</span></div>`);
 $('.sidebar .side-note').textContent='測試樣本 · 離線可用';
 document.title+='｜'+vatSampleTiers[vatSampleTier].label+'樣本';
}
function finishVatSampleLoading(){
 vatSampleLoading=false;
 renderAll();
 $('.app').classList.remove('vat-sample-loading');
 $('.app').inert=false;
 $('.vat-sample-progress')?.remove();
}
const renderBeforeVatSample=renderAll;
renderAll=function(){
 if(vatSampleLoading)return;
 const result=renderBeforeVatSample();
 mountVatSampleBar();
 return result;
};
const switchBeforeVatSample=switchView;
switchView=function(view){
 const previous=state.view,result=switchBeforeVatSample(view);
 mountVatSampleBar();
 if(vatSampleTier&&previous!==state.view)history.replaceState(null,'',vatSampleURL(vatSampleTier,state.view));
 return result;
};
const backupBeforeVatSample=backupData;
backupData=async function(kind){
 const backup=await backupBeforeVatSample(kind);
 if(vatSampleTier)backup.sampleTier=vatSampleTier;
 return backup;
};
const validateBeforeVatSample=validateBackup210;
validateBackup210=function(backup){
 if(backup?.sampleTier&&!vatSampleTier)throw Error('測試樣本備份請在樣本模式內匯入');
 if(vatSampleTier&&!Object.hasOwn(vatSampleTiers,backup?.sampleTier))throw Error('樣本模式僅匯入測試樣本備份');
 return validateBeforeVatSample(backup);
};
const downloadBeforeVatSample=downloadBackup;
downloadBackup=function(prefix){
 return downloadBeforeVatSample(vatSampleTier?'測試樣本_'+(prefix||'營業稅備份'):prefix);
};

async function seedVatSamples(){
 if(!vatSampleTier||db?.name!==vatSampleDatabase)throw Error('測試樣本資料庫未就緒');
 await seedDefaults();
 const {clients:count,depth}=vatSampleTiers[vatSampleTier],at=nowISO(),audit={createdAt:at,updatedAt:at};
 const today=localDate(),anchor=new Date(today+'T12:00:00');
 const day=(offset,base=anchor)=>{
  const date=new Date(base);date.setDate(date.getDate()+offset);return localDate(date);
 };
 const stores={clients:[],periods:[],periodClients:[],notificationTypes:[],templates:[],notifications:[],
  calendarNotes:[],workTasks:[],cases:[],contracts:[],leaseRates:[]};
 const dateNames=['青禾設計','遠帆商行','四季咖啡','北岸製作','暖光服務','日常選物','在地物流','晨讀工作室'];
 const longName='跨部門聯絡窗口與多據點發票收集、採購驗收及帳務彙整';
 const note='樣本｜已整理本期發票與附件。\n待核對分店寄件日期，並與會計窗口確認後續補件。';
 const workNames=['收齊紙本發票','核對進項與扣抵憑證','整理繳稅資料','確認銀行入帳','更新客戶共用備註','補齊期末附件'];
 const caseNames=['公司登記事項變更','待補文件追蹤','分店租約與發票核對','年度帳務複核','一般客服與交件','跨年度資料整理'];
 const caseEngine=createCasesEngine219();
 const statuses=['inProgress','pending','done','cancelled'];
 state.settings={...(await getOne('settings','main')),dispatchLeadDays:3,reminderDays:[5,2],
  couriers:['樣本郵寄','樣本快遞','樣本自取'].slice(0,depth),
  theme:vatPrefs.getItem('vatTheme')==='dark'?'dark':'light',
  dateMode:vatPrefs.getItem('vatDateMode')==='roc'?'roc':'gregorian',updatedAt:at};
 const receipts=state.settings.receiptStatuses;
 const currentStart=new Date(anchor.getFullYear(),Math.floor(anchor.getMonth()/2)*2,1,12);
 for(const offset of [-1,0,1].slice(0,depth===1?2:3)){
  const start=new Date(currentStart.getFullYear(),currentStart.getMonth()+offset*2,1,12);
  const year=start.getFullYear(),slot=Math.floor(start.getMonth()/2)+1;
  stores.periods.push({id:year+'-'+slot,year,slot,status:offset<0?'已結束':offset>0?'尚未開始':'進行中',
   dueDate:statutoryDueDate(year,String(slot).padStart(2,'0')),latestDispatchDate:day(5+offset*30),latestRemitDate:day(12+offset*30),
   sharedMessages214:offset?[]:['樣本期間共用備註','請核對納稅與收件資料'],...audit});
 }
 const current=stores.periods[1];
 for(let index=0;index<count;index++){
  const key=String(index+1).padStart(3,'0'),varied=index%6;
  const client={id:'sample-client-'+key,code:'DEMO-'+key,name:'樣本'+key+'｜'+(index%7===1?longName:dateNames[index%dateNames.length]),
   businessItem:['零售','設計服務','租賃','餐飲'][index%4],
   address:'樣本地址｜測試區 '+key+' 號',contacts:[{name:'樣本聯絡人',title:'帳務窗口',contact:'樣本聯繫方式'}],
   bookkeepingFee:1800+varied*500,stickerCount:varied+1,note:index%3===0?note:'',
   shippingPreset:{type:['郵寄','自取','快遞'][index%3],addressSource:'client',recipientSource:'client'},...audit};
  stores.clients.push(client);
  for(const period of stores.periods){
   // Full current-period coverage, with overlapping customers for cross-period paths.
   if(period!==current&&index>[2,11,23][depth-1])continue;
   const pc=newPeriodClient214(client,period);
   stores.periodClients.push(pc);
   if(period.status==='尚未開始')continue;
   const isCurrent=period===current;
   const tax=[6320,-860,0,'',19400,4180][varied];
   Object.assign(pc,{appointmentDate:isCurrent?day(index<2?1:varied-2):day(-32),
    receiptStatusId:receipts[index<2?index:varied%3].id,receiptNote:index%2===0?note:'',
    taxAmount:tax,salesRevenue214:[234000,69000,0,'',2850000,42300][varied],
    billingConfirmed:varied!==3,taxPaid:index%5===4&&Number(tax)>0,
    plannedTaxPayDate:isCurrent&&Number(tax)>0?day(8):'',notes:varied%2===0?note:'',
    carryInvoiceForward:!isCurrent&&varied===1});
   if(pc.taxPaid){pc.taxPaidDate=day(isCurrent?-1:-24);pc.taxPaidAmount=tax;}
   if(varied===0||varied===4){
    pc.fees.push({id:'sample-fee-'+pc.id,name:'樣本代辦費',amount:600+varied*160,note:'樣本附件費用',...audit});
    pc.payments.push({id:'sample-payment-'+pc.id,date:day(isCurrent?-1:-26),amount:isCurrent?1580:860,target:'auto',account:'',note:'測試入帳',...audit});
   }
   const docs=(kind,qty)=>Array.from({length:qty},(_,i)=>{
    const id='sample-'+kind+'-'+pc.id+'-'+i,done=i>0&&(index+i)%3===0;
    return {id,name:kind==='missing'?workNames[i%workNames.length]:'樣本待歸資料 '+(i+1),note:i===0?note:'',
     status:done?'done':'pending',completedAt:done?at:'',recordedAt:at,sourcePeriodId:period.id,sourceItemId:id,lineageRootId:id,
     taskPlan:isCurrent?{date:day(i%5),time:'10:30'}:{},...audit};
   });
   if(varied===5){pc.accountingCompletedAt=at;}
   else pc.accountingMissingDocs=docs('missing',isCurrent?(index===0?depth*3:varied%3):Number(varied===1));
   pc.accountingReturnItems=isCurrent?docs('return',varied%3+1):[];
  }
  const makeCount=index===0?[1,6,16][depth-1]:depth===1?1:(1+index%depth);
  for(let i=0;i<makeCount;i++){
   const recordKey=key+'-'+i;
   const status=statuses[(index+i)%statuses.length];
   stores.cases.push(caseEngine.planSave({draft:{id:'sample-case-'+recordKey,clientId:client.id,
    title:'樣本｜'+caseNames[(index+i)%caseNames.length]+(i?' '+(i+1):''),
    status,startDate:day(-(9+i)),dueDate:day((index+i)%11-2),dueTime:'16:30',
    reminderEnabled:i%3!==2,reminderDate:day((index+i)%6-2),reminderTime:'09:30',
    note:index%4===1?note+'\n'+longName:i%3===0?note:''},clients:[client],at,today}));
   const isLease=(index+i)%4!==2,closed=(index+i)%7===6;
   const startDate=day([ -180,-350,-215,-40,12,-728 ][(index+i)%6]),endDate=day([ 45,18,-12,90,190,-21 ][(index+i)%6]);
   let lease;
   if(isLease){
    lease=leaseEngine224.defaultLease();
    lease.deposit=6000000;
    lease.steps=[{from:startDate,cents:2400000+varied*250000}];
    const later=day(16);
    if(startDate<later&&later<endDate)lease.steps.push({from:later,cents:2500000+varied*250000});
    const period=leaseEngine224.periods(startDate,endDate,lease.frequency).find(row=>row.end<today);
    if(period)lease.checks.push({...leaseEngine224.emptyCheck(period.key),rentStatus:'issued',rentActual:lease.steps[0].cents,interestStatus:'missing'});
   }
   stores.contracts.push(contractEngine220.save({draft:{id:'sample-contract-'+recordKey,clientId:client.id,
    categoryId:isLease?'lease':'other',title:'樣本｜'+(isLease?'營業據點租約':'委託服務合約')+(i?' '+(i+1):''),
    startDate,endDate,closed,leadMonths:2,reminderEnabled:!closed,task:'核對到期與續約文件',note:i===0?note:'',
    ...(lease?{lease}:{})},clients:[client],categories:[],at}));
  }
  if(index%2===0||depth===3){
   const completed=index%5===2;
   stores.workTasks.push({id:'sample-task-'+key,periodId:current.id,clientId:client.id,
    name:'樣本｜'+workNames[index%workNames.length],note,taskPlan:{date:day(index%9-3),time:'14:00'},
    status:completed?'done':'pending',completedAt:completed?at:'',...audit});
   const date=day(index%13-5);
   stores.calendarNotes.push({id:'sample-calendar-'+key,clientId:client.id,date,time:index%4===0?'':'15:30',
    content:'樣本｜'+caseNames[index%caseNames.length],reminderEnabled:index%4===2,reminderDate:date,reminderTime:'09:00',
    reminderCompletedAt:'',...audit});
   stores.notifications.push({id:'sample-notice-'+key,periodId:current.id,periodClientId:current.id+'::'+client.id,
    clientId:client.id,type:'receiptAsk',typeId:'receiptAsk',templateId:'receiptAsk',content:'樣本通知｜'+client.name+'，請確認收件日期。',sentAt:at,...audit});
  }
 }
 const year=anchor.getFullYear();
 stores.leaseRates.push({id:String(year-1),rate:15000},{id:String(year),rate:17250});
 const receipt=await getOne('templates','receiptAsk');
 stores.templates.push({...receipt,text:'【樣本通知】{聯繫人}您好：\n請協助確認 {客戶} 的收發票日期。\n本期銷貨收入：{銷貨收入} 元。'});
 for(let i=0;i<depth*2;i++){
  const typeId='sample-type-'+i;
  stores.notificationTypes.push({id:typeId,name:'樣本通知｜'+workNames[i],noticeGroup212:'custom',enabled:true,...audit});
  for(let j=0;j<depth;j++)stores.templates.push({id:typeId+'-'+j,typeId,name:'樣本模板 '+(j+1),
   text:'{客戶} 您好：\n'+note+'\n本期尚欠 {尚欠金額} 元。',enabled:true,
   remindersEnabled:j===0,reminders:j===0?[{id:'sample-reminder-'+i,mode:'relative',base:'latestRemitDate',days:2}]:[],...audit});
 }
 await new Promise((resolve,reject)=>{
  const transaction=db.transaction([...Object.keys(stores),'settings'],'readwrite');
  for(const [store,rows] of Object.entries(stores))for(const row of rows)transaction.objectStore(store).put(row);
  transaction.objectStore('settings').put(state.settings);
  transaction.oncomplete=resolve;
  transaction.onabort=()=>reject(transaction.error||Error('測試樣本未能載入'));
 });
 state.periodId=current.id;
}
