const contractEngine220=createContractsEngine220();
const contractRuntime220={query:'',clientId:'',categoryId:'',year:'',status:'all',page:1,size:12,expanded:new Set(),folders:new Map(),limits:new Map()};
const contractStatus220={
 upcoming:['即將到期','orange'],expired:['已到期','red'],active:['有效','green'],scheduled:['未生效','blue'],closed:['已結案','gray'],renewed:['已續約','blue']
};
const contracts220=()=>state.contracts||[];
const customContractTypes220=()=>state.contractCategories||[];
const contractTypes220=()=>[...contractEngine220.builtins,...customContractTypes220().slice().sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'))];
const contractTypeName220=id=>contractTypes220().find(type=>type.id===id)?.name||'類別待核對';
const contractBadge220=status=>statusBadge(...contractStatus220[status]);
const contractID220=id=>contracts220().find(row=>row.id===id);
const contractReminderDate220=row=>contractEngine220.reminderDate(row.endDate,row.leadMonths);
const nextContract220=id=>contracts220().find(row=>row.previousContractId===id);
function contractRefsReady237(row){
 if(!clientById(row.clientId)||!contractTypes220().some(type=>type.id===row.categoryId))return false;
 if(!row.previousContractId)return true;
 const previous=contractID220(row.previousContractId);
 return previous?.clientId===row.clientId&&row.startDate>previous.endDate;
}
const contractDue220=(row,renewed=!!nextContract220(row.id))=>contractRefsReady237(row)&&contractEngine220.isDue(row,localDate(),renewed);

function writeContract220({id,draft,drafts,baseline=null,categoryName='',action='save',renewalFrom=null,detachPrevious=false,effectiveDate=''}) {
 return new Promise((resolve,reject)=>{
  let transaction;
  try{transaction=db.transaction(['contracts','clients','contractCategories'],'readwrite');}
  catch(error){reject(error);return;}
  let failure,result,written=false;
  const contracts=transaction.objectStore('contracts'),types=transaction.objectStore('contractCategories');
  const records=contracts.getAll(),clients=transaction.objectStore('clients').getAll(),categories=types.getAll();
  const write=()=>{
   if(written||[records,clients,categories].some(request=>request.readyState!=='done'))return;
   written=true;
   try{
    const rows=records.result;
    if(drafts){
     const ids=new Set(rows.map(row=>row.id)),at=nowISO();
     result=drafts.map((draft,index)=>{
      try{
       if(ids.has(draft.id))throw Error('合約編號已存在，請重試');
       ids.add(draft.id);
       return contractEngine220.save({draft,clients:clients.result,categories:categories.result,at});
      }catch(error){error.row=index;throw error;}
     });
     for(const row of result)contracts.add(row);
     return;
    }
    const before=rows.find(row=>row.id===id)||null;
    const renewed=contractEngine220.successors(rows);
    if(renewalFrom){
     const source=rows.find(row=>row.id===renewalFrom.id);
     contractEngine220.assertBaseline(source,renewalFrom);
     if(renewed.has(source.id))throw Error('此合約已續約，請開啟下一期合約');
    }
    if(action==='delete'){
     contractEngine220.assertBaseline(before,baseline);
     if(renewed.has(id))throw Error('此合約還有下一期，請先處理續約紀錄');
     contracts.delete(id);
     return;
    }
    const at=nowISO();
    let linked=[];
    if(action==='rent-confirm'){
     result=contractEngine220.confirmRentReminder({current:before,baseline,at,today:localDate(),effectiveDate});
    }else if(action==='complete'||action==='reopen'){
     if(renewed.has(id))throw Error('此合約已續約，請到下一期處理待辦');
     result=contractEngine220.updateTask({current:before,baseline,at,today:localDate(),completed:action==='complete'});
    }else{
     if(before&&!baseline)throw Error('合約編號已存在，請重新新增');
     const options=categories.result;
     const next={...draft,id};
     if(categoryName){
      const type=contractEngine220.categoryFor(categoryName);
      next.categoryId=type.id;
      if(!contractEngine220.builtins.some(row=>row.id===type.id)&&!options.some(row=>row.id===type.id)){
       options.push(type);
       types.add(type);
      }
     }
     if(detachPrevious&&(!before?.previousContractId||rows.some(row=>row.id===before.previousContractId))){
      throw Error('上期合約連結已更新，請重新開啟合約');
     }
     const previousContractId=detachPrevious?'':renewalFrom?.id||before?.previousContractId;
     result=contractEngine220.save({draft:next,current:before,baseline,clients:clients.result,categories:options,at,previousContractId});
     if(before&&before.clientId!==result.clientId&&!clients.result.some(client=>client.id===before.clientId)){
      linked=contractEngine220.relinkMissingCustomer(rows,before,result.clientId,at);
     }
    }
    const edited=new Set([id,...linked.map(row=>row.id)]);
    const candidate=[...rows.filter(row=>!edited.has(row.id)),result,...linked];
    if(action!=='save')contractEngine220.normalize(result,{clients:clients.result,categories:categories.result});
    contractEngine220.validateLinks(candidate,{changedIds:edited});
    for(const row of linked)contracts.put(row);
    contracts.put(result);
   }catch(error){failure=error;transaction.abort();}
  };
  for(const request of [records,clients,categories])request.onsuccess=write;
  transaction.oncomplete=()=>resolve(result);
  transaction.onabort=()=>reject(failure||transaction.error||Error('合約資料未儲存'));
 });
}

function contractTypeOptions220(selected='') {
 return contractTypes220().map(type=>`<option value="${esc(type.id)}" ${type.id===selected?'selected':''}>${esc(type.name)}</option>`).join('');
}
function revealSavedContracts237(rows,{focusClient=false}={}){
 const clientId=focusClient?rows[0].clientId:'';
 Object.assign(contractRuntime220,{query:'',status:'all',year:'',categoryId:'',clientId,
  revealIds:new Set(rows.map(row=>row.id))});
 $('#contractSearch220').value='';
}
function mountContracts220() {
 const view=$('#view-contracts');
 if(!view||$('#contractsList220'))return;
 view.innerHTML=`<div class="page-head"><h1 class="page-title">租約與合約</h1>
  <div class="actions"><details class="contract-settings228"><summary class="btn ghost">設定</summary>
   <div><button class="btn ghost" type="button" id="leaseRatesBtn224">年度郵政利率</button></div></details>
   <button class="btn" type="button" id="newLeaseBatch228">批量新增租約</button>
   <button class="btn primary" type="button" id="newContract220">新增合約</button></div></div>
 <div class="contract-stats220" id="contractStats220" role="group" aria-label="依狀態篩選合約"></div>
 <div class="contract-filters220">
  <div class="field"><label for="contractSearch220">搜尋合約</label><input id="contractSearch220" class="input" type="search" placeholder="名稱、客戶或備註"></div>
  <div class="field"><label for="contractClientFilter220">客戶</label><select id="contractClientFilter220" class="select"></select></div>
  <div class="field"><label for="contractCategoryFilter220">類別</label><select id="contractCategoryFilter220" class="select"></select></div>
  <div class="field"><label for="contractStatusFilter220">狀態</label><select id="contractStatusFilter220" class="select"><option value="all">全部狀態</option>
   ${Object.entries(contractStatus220).map(([key,[label]])=>`<option value="${key}">${label}</option>`).join('')}</select></div>
  <div class="field"><label for="contractYearFilter221">到期年度</label><select id="contractYearFilter221" class="select"></select></div>
  <button class="btn" type="button" id="contractClearFilter220">清除條件</button>
 </div>
 <div class="cases-result219" id="contractCount220" aria-live="polite"></div>
 <div id="contractsList220"></div><div id="contractPagination220"></div>`;
 $('#newContract220').onclick=()=>openContract220();
 $('#newLeaseBatch228').onclick=()=>openLeaseBatch228();
 bindLeaseRates224($('#leaseRatesBtn224'));
 for(const [selector,key,event] of [['#contractSearch220','query','input'],['#contractClientFilter220','clientId','change'],
  ['#contractCategoryFilter220','categoryId','change'],['#contractStatusFilter220','status','change'],['#contractYearFilter221','year','change']]){
  $(selector).addEventListener(event,ev=>{Object.assign(contractRuntime220,{[key]:ev.target.value,page:1});renderContracts220();});
 }
 $('#contractClearFilter220').onclick=()=>{
  Object.assign(contractRuntime220,{query:'',clientId:'',categoryId:'',year:'',status:'all',page:1});
  $('#contractSearch220').value='';
  renderContracts220();
 };
}
function contractTaskLabel220(row,renewed=!!nextContract220(row.id)) {
 if(!contractRefsReady237(row))return '待核對關聯';
 if(!row.reminderEnabled)return '未啟用';
 if(row.taskCompletedAt)return '已完成 '+fmtDateTime(row.taskCompletedAt);
 if(row.closed||renewed)return '已停止';
 return contractDue220(row)?'待處理':'尚未到提醒日';
}
function renderContracts220() {
 mountContracts220();
 const host=$('#contractsList220');
 if(!host)return;
 const runtime=contractRuntime220,today=localDate(),query=runtime.query.trim().toLocaleLowerCase();
 if(runtime.clientId&&!clientById(runtime.clientId))runtime.clientId='';
 if(runtime.categoryId&&!contractTypes220().some(type=>type.id===runtime.categoryId))runtime.categoryId='';
 const records=contracts220(),successors=contractEngine220.successors(records);
 const all=records.map(row=>({row,status:contractEngine220.status(row,today,successors.has(row.id))}));
 const years=[...new Set(records.map(row=>row.endDate.slice(0,4)))].sort().reverse();
 if(runtime.year&&!years.includes(runtime.year))runtime.year='';
 $('#contractYearFilter221').innerHTML='<option value="">全部年度</option>'+years.map(year=>
  `<option value="${esc(year)}" ${year===runtime.year?'selected':''}>${esc(fmtDate(year+'-01-01').split('/')[0])} 年</option>`).join('');
 const counts=Object.fromEntries(Object.keys(contractStatus220).map(key=>[key,0]));
 const clientFilter=$('#contractClientFilter220'),categoryFilter=$('#contractCategoryFilter220');
 clientFilter.innerHTML='<option value="">全部客戶</option>'+recordClientOptions220(runtime.clientId);
 categoryFilter.innerHTML='<option value="">全部類別</option>'+contractTypeOptions220(runtime.categoryId);
 $('#contractStatusFilter220').value=runtime.status;
 const filtered=all.filter(({row,status})=>{
  if(runtime.clientId&&runtime.clientId!==row.clientId)return false;
  if(runtime.categoryId&&runtime.categoryId!==row.categoryId)return false;
  if(runtime.year&&!row.endDate.startsWith(runtime.year+'-'))return false;
  const customer=clientById(row.clientId);
  if(query&&![row.title,row.note,row.task,contractTypeName220(row.categoryId),customer?.code,customer?.name].join(' ').toLocaleLowerCase().includes(query))return false;
  counts[status]++;
  return runtime.status==='all'||runtime.status===status;
 }).sort((a,b)=>Number(['closed','renewed'].includes(a.status))-Number(['closed','renewed'].includes(b.status))||a.row.endDate.localeCompare(b.row.endDate)||a.row.id.localeCompare(b.row.id));
 renderRecordStatusFilters227($('#contractStats220'),Object.entries(contractStatus220).map(([key,[label,tone]])=>[key,label,counts[key],tone]),runtime,'all',renderContracts220);
 const statusById=new Map(all.map(({row,status})=>[row.id,status]));
 const makeRow=row=>{
  const status=statusById.get(row.id),type=contractTypeName220(row.categoryId);
  const isLease=row.categoryId==='lease'||!!row.lease;
  const rent=isLease?leaseRentDisplay225(row,today):null;
  const reminder=row.reminderEnabled?fmtDate(contractReminderDate220(row)):'';
  const next=successors.get(row.id),previous=row.previousContractId&&records.find(other=>other.id===row.previousContractId);
  const due=contractDue220(row,!!next);
  const taskStatus=contractTaskLabel220(row,!!next);
  const action=due?`<button class="btn primary" type="button" data-contract-complete220="${esc(row.id)}">完成待辦</button>`:
   row.taskCompletedAt&&!row.closed&&!next&&row.reminderEnabled&&contractRefsReady237(row)?`<button class="btn" type="button" data-contract-reopen220="${esc(row.id)}">重開待辦</button>`:'';
  return {id:row.id,keyAttribute:'data-contract-id220',clickToExpand:true,title:row.title,
   cells:[
    `<h2>${esc(row.title)}</h2><small>${esc(type)}</small>${rent?`<span class="contract-rent-amount225">${esc(rent.label)} <strong>${esc(rent.value)}</strong></span>`:''}`,
    contractBadge220(status)+(!contractRefsReady237(row)?' '+statusBadge('待核對關聯','orange'):''),
    `<strong>${esc(fmtDate(row.endDate))}</strong><small>${esc(next?'下一期 '+fmtDate(next.startDate):due?'待辦未完成':row.taskCompletedAt?'待辦已完成':row.reminderEnabled&&!row.closed?'提醒 '+reminder:'')}</small>`,
    `<button class="btn" type="button" data-open-contract220="${esc(row.id)}">管理合約</button>
     ${!next&&contractRefsReady237(row)&&contractEngine220.shiftDay(row.endDate,1)?`<button class="btn record-secondary-action227" type="button" data-contract-renew221="${esc(row.id)}">續約</button>`:''}`
   ],
   schedule:[['開始',row.startDate?fmtDate(row.startDate):'',row.startDate],['提醒',reminder,contractReminderDate220(row)],['到期',fmtDate(row.endDate),row.endDate]],
   extra:leaseSummary224(row),
   facts:[['提醒狀態',row.reminderEnabled?taskStatus:''],['待辦',row.reminderEnabled?row.task:''],
    ...(previous?[['上期合約',previous.title+' · '+fmtDate(previous.endDate)]]:row.previousContractId?[['上期合約','找不到上期，請在管理合約核對']]:[]),
    ...(next?[['續約期間',fmtDate(next.startDate)+' ～ '+fmtDate(next.endDate)]]:[])],note:row.note,
   detailActions:`<div class="record-detail-actions220"><button class="btn record-secondary-action227" type="button" data-contract-calendar220="${esc(row.id)}">查看日曆</button>${previous?`<button class="btn record-secondary-action227" type="button" data-open-contract220="${esc(previous.id)}">查看上期</button>`:''}${next?`<button class="btn record-secondary-action227" type="button" data-open-contract220="${esc(next.id)}">查看續約</button>`:''}${action}</div>`
  };
 };
 const count=clientFolders222({host,pager:$('#contractPagination220'),runtime,matched:filtered.map(item=>item.row),all:records,kind:'合約',
  columns:['合約／類別','狀態','到期／提醒','操作'],makeRow,render:renderContracts220,bind:bindContractActions220,
  folderAction:customer=>`<button class="btn" type="button" data-lease-batch228="${esc(customer.id)}">＋ 批量新增租約</button>`});
 $('#contractCount220').textContent=`${count} 位客戶 · ${filtered.length} 筆合約`;
}

function openContract220(id,renewalFrom=null,initialPane='basic') {
 let existing=id?contractID220(id):null;
 if(id&&!existing){toast('合約已被刪除，請重新整理');return;}
 if(!existing&&!state.clients.length){toast('請先在客戶庫新增客戶');return;}
 const renewalStart=renewalFrom?contractEngine220.shiftDay(renewalFrom.endDate,1):'';
 if(renewalFrom&&(!renewalStart||nextContract220(renewalFrom.id))){toast('此合約無法再從這一期續約');return;}
 if(renewalFrom&&!clientById(renewalFrom.clientId)){toast('請先在管理合約重新選擇客戶');return;}
 if(renewalFrom&&!contractTypes220().some(type=>type.id===renewalFrom.categoryId)){toast('請先在管理合約選擇有效類別');return;}
 if(renewalFrom?.previousContractId&&!contractID220(renewalFrom.previousContractId)){toast('請先在管理合約核對上期連結');return;}
 const draft=existing?clone(existing):{id:uid('contract'),clientId:'',categoryId:'lease',title:'',startDate:'',endDate:'',leadMonths:1,
  closed:false,reminderEnabled:true,task:'確認續約或結案',note:''};
 if(draft.lease)draft.lease=leaseEngine224.normalize(draft.lease,draft.startDate,draft.endDate);
 if(renewalFrom)Object.assign(draft,{
  clientId:renewalFrom.clientId,categoryId:renewalFrom.categoryId,title:renewalFrom.title,
  startDate:renewalStart,endDate:contractEngine220.termEnd(renewalStart,1),
  leadMonths:renewalFrom.leadMonths,reminderEnabled:renewalFrom.reminderEnabled,task:renewalFrom.task
 });
 const previous=existing?.previousContractId?contractID220(existing.previousContractId):null;
 const previousMissing=!!existing?.previousContractId&&!previous;
 const renewalCosts=renewalFrom?contractEngine220.renewalLease(renewalFrom,renewalStart):undefined;
 const inherited=previous?.clientId===draft.clientId&&draft.startDate>previous.endDate&&!draft.lease?.steps.length
  ?contractEngine220.renewalLease(previous,draft.startDate):undefined;
 const recoveredRent=!!inherited?.steps.length;
 if(recoveredRent){
  if(!draft.lease)draft.lease=inherited;
  else draft.lease.steps=inherited.steps.map(step=>({...step,cents:leaseEngine224.convertRent(
   step.cents,inherited.rentBasis,draft.lease.rentBasis,draft.lease.rentVatRate)}));
 }
 const clientMissing=!!draft.clientId&&!clientById(draft.clientId);
 const categoryMissing=!contractTypes220().some(type=>type.id===draft.categoryId);
 const root=$('#modalRoot'),origin=document.activeElement;
 const field=(key,label,contents)=>`<div class="field"><label for="contract-${key}220">${label}</label>${contents}
  <span class="contract-field-error220" data-contract-field-error220="${key}" hidden></span></div>`;
 const input=(key,type,value,extra='')=>`<input id="contract-${key}220" class="input" type="${type}" value="${esc(value)}" ${extra}>`;
 const customer=`<select class="select" id="contract-clientId220" required><option value="">${clientMissing?'找不到原客戶，請重新選擇':'選擇客戶'}</option>${recordClientOptions220(draft.clientId)}</select>`;
 const category=`<select class="select" id="contract-categoryId220">${categoryMissing?'<option value="" selected>找不到原類別，請重新選擇</option>':''}${contractTypeOptions220(draft.categoryId)}<option value="__new">＋ 新增類別</option></select>`;
 const basic=`<form id="contractForm220" class="cases-form219 record-form222" novalidate>
  ${renewalFrom?`<p class="cases-span219 contract-renew-info221">上期到期日 <strong>${esc(fmtDate(renewalFrom.endDate))}</strong>${renewalCosts?' · 已帶入月租與押金，可修改':''}</p>`:''}
  ${previous?`<p class="cases-span219 contract-renew-info221">上期合約 <strong>${esc(previous.title)}</strong> · ${esc(fmtDate(previous.endDate))} 到期</p>`:''}
  ${clientMissing&&(previous?.clientId===draft.clientId||nextContract220(draft.id)?.clientId===draft.clientId)?'<p class="notice warn cases-span219">重新選擇客戶後，連續期別的合約會一併連回該客戶。</p>':''}
  ${previousMissing?`<label class="notice warn cases-span219 cases-check219"><input type="checkbox" id="contractDetachPrevious237">找不到上期合約。勾選後儲存可解除舊連結，保留本期資料。</label>`:''}
  <div class="cases-span219">${field('title','合約名稱',input('title','text',draft.title,'required maxlength="200"'))}</div>
  ${field('clientId','客戶',customer)}${field('categoryId','類別',category)}
  <div class="cases-span219" id="contractNewCategory220" hidden>${field('categoryName','新類別名稱',input('categoryName','text','','maxlength="32"'))}</div>
  ${renewalFrom?`<div class="field cases-span219"><label for="contractRenewTerm221">續約期限</label><select class="select" id="contractRenewTerm221">
   <option value="1">1 年</option><option value="2">2 年</option><option value="3">3 年</option><option value="">自訂到期日</option></select></div>`:''}
  ${field('startDate',renewalFrom?'新約開始日期':'開始日期（選填）',input('startDate','date',draft.startDate))}
  ${field('endDate','到期日',input('endDate','date',draft.endDate,'required'))}
  ${existing?'':`<div class="contract-costs231 cases-span219">
   <details class="record-settings222 contract-rent-settings225" id="contractRent225" ${draft.categoryId==='lease'||renewalCosts?.steps.length?'open':''}>
    <summary>每月租金</summary>
    <div class="contract-rent-fields225">
     ${field('monthlyRent','月租（元）',input('monthlyRent','text',leaseEngine224.format(renewalCosts?.steps[0]?.cents),'inputmode="decimal"'))}
     ${field('rentBasis','金額基準',`<select id="contract-rentBasis220" class="select">${[['net','未稅'],['gross','含稅']].map(([key,label])=>leaseOption224(key,label,renewalCosts?.rentBasis)).join('')}</select>`)}
    </div>
   </details>
   <details class="record-settings222 contract-rent-settings225" id="contractDeposit231" ${draft.categoryId==='lease'||renewalCosts?.deposit!=null?'open':''}>
    <summary>押金紀錄</summary>
    ${field('deposit','押金本金（元）',input('deposit','text',leaseEngine224.format(renewalCosts?.deposit),'inputmode="decimal" placeholder="無押金填 0"'))}
    <output id="contractDepositPreview232" class="contract-deposit-preview232" role="status" hidden></output>
   </details>
  </div>`}
  <div class="record-reminder-settings227 cases-span219">
   <div class="record-setting-head222">
    <label class="cases-check219 record-toggle222"><input id="contract-reminderEnabled220" type="checkbox" aria-controls="contractReminderFields222" ${draft.reminderEnabled?'checked':''}>到期提醒</label>
    <span class="record-preview-date222" id="contractPreviewDate220" aria-live="polite"></span>
   </div>
   <div class="contract-reminder-inputs222" id="contractReminderFields222" ${draft.reminderEnabled?'':'hidden'}>
    ${field('leadMonths','提前月數',input('leadMonths','number',draft.leadMonths,'min="0" max="36" step="1" aria-describedby="contractPreviewDate220"'))}
    ${field('task','待辦事項',input('task','text',draft.task,'maxlength="240"'))}
   </div>
  </div>
  <div class="cases-span219 field"><label for="contract-note220">備註</label><textarea class="textarea" id="contract-note220" maxlength="12000" rows="2">${esc(draft.note)}</textarea></div>
  ${renewalFrom?'<input id="contract-closed220" type="checkbox" hidden>':`<label class="cases-check219"><input id="contract-closed220" type="checkbox" ${draft.closed?'checked':''}>已結案</label>`}
  <p class="notice warn cases-span219" id="contractError220" role="alert" tabindex="-1" hidden></p>
 </form>`;
 showModal(renewalFrom?'續約':existing?'管理合約':'新增合約',existing?contractLeasePanels228(draft,basic,{recoveredRent}):basic,[{text:'取消',value:false},{text:renewalFrom?'確認續約':'儲存合約',value:true,cls:'primary'}],()=>{});
 const modal=root.querySelector('.modal'),form=$('#contractForm220'),error=$('#contractError220');
 modal.classList.add('cases-modal219','contract-modal220','record-modal222');
 if(existing){
  modal.classList.add('lease-modal224','contract-manager228');
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-labelledby','contractManagerTitle228');
  modal.querySelector('.modal-title').id='contractManagerTitle228';
  modal.querySelector('[data-close]').setAttribute('aria-label','關閉');
 }
 const footer=modal.querySelector('.modal-foot'),[cancel,save]=footer.querySelectorAll('button');
 save.id='saveContract220';cancel.id='cancelContract220';
 const get=key=>$('#contract-'+key+'220');
 const leadValue=()=>{
  const value=get('leadMonths').value;
  if(get('reminderEnabled').checked)return value;
  try{return contractEngine220.months(value);}catch{return draft.leadMonths;}
 };
 const collect=()=>({id:draft.id,title:get('title').value,clientId:get('clientId').value,categoryId:get('categoryId').value,
  startDate:get('startDate').value,endDate:get('endDate').value,leadMonths:leadValue(),
  reminderEnabled:get('reminderEnabled').checked,task:get('task').value,closed:get('closed').checked,note:get('note').value,
  ...(existing?.leaseNotices?{leaseNotices:existing.leaseNotices}:{})});
 const term=$('#contractRenewTerm221');
 if(renewalFrom)get('clientId').disabled=true;
 if(term){
  if(!draft.endDate)term.value='';
  const updateTerm=()=>{
   get('endDate').readOnly=!!term.value;
   if(term.value)get('endDate').value=contractEngine220.termEnd(get('startDate').value,Number(term.value));
  };
  term.addEventListener('change',updateTerm);
  get('startDate').addEventListener('input',updateTerm);
  updateTerm();
 }
 const rentPanel=$('#contractRent225'),depositPanel=$('#contractDeposit231');
 if(rentPanel)get('categoryId').addEventListener('change',()=>{
  const isLease=get('categoryId').value==='lease';
  rentPanel.open=isLease||!!get('monthlyRent').value.trim();
  depositPanel.open=isLease||!!get('deposit').value.trim();
 });
 const lease=existing?mountContractLease228(modal,draft,collect,notice=>commit('save',notice)):null;
 const detach=$('#contractDetachPrevious237');
 const snapshot=()=>JSON.stringify([collect(),get('categoryName').value,term?.value,get('monthlyRent')?.value,get('rentBasis')?.value,get('deposit')?.value,detach?.checked]);
 let initial=snapshot();
 let busy=false;
 function updateNewDepositPreview(){
  const output=$('#contractDepositPreview232'),value=get('deposit').value.trim();
  output.hidden=!value;
  if(!value)return;
  let deposit;
  try{deposit=leaseEngine224.amount(value);}
  catch{output.textContent='請核對押金本金格式。';return;}
  const year=get('startDate').value.slice(0,4);
  if(!year){output.textContent='選擇開始日期後即可試算。';return;}
  const annual=leaseRates224().find(row=>row.id===year)?.rate??null;
  const {gross,interest,needsRate}=leaseEngine224.interestAmounts({...(renewalCosts||leaseEngine224.defaultLease()),deposit,annual,months:1});
  output.textContent=needsRate?leaseYear224(year)+'尚未設定郵政利率，儲存合約後可在押金紀錄補填。':
   leaseYear224(year)+'每月設算利息 '+leaseMoney224(gross)+' · 應列銷售額 '+leaseMoney224(interest);
 }
 function updatePreview(){
  const requiresStart=!!renewalFrom||!!get('monthlyRent')?.value.trim()||!!get('deposit')?.value.trim()||!!existing?.lease;
  get('startDate').required=requiresStart;
  if(!renewalFrom)form.querySelector('label[for="contract-startDate220"]').textContent=requiresStart?'開始日期（必填）':'開始日期（選填）';
  $('#contractNewCategory220').hidden=get('categoryId').value!=='__new';
  let date='';
  try{date=contractEngine220.reminderDate(get('endDate').value,get('leadMonths').value);}catch{}
  $('#contractReminderFields222').hidden=!get('reminderEnabled').checked;
  $('#contractPreviewDate220').textContent=get('reminderEnabled').checked&&date?'提醒日 '+fmtDate(date):'';
  if(depositPanel)updateNewDepositPreview();
  const context=$('#contractManagerContext228');
  if(context)context.textContent=[clientById(get('clientId').value)?.name,get('title').value.trim()].filter(Boolean).join(' · ');
 }
 form.addEventListener('input',event=>{
  const key=event.target.id?.match(/^contract-(\w+)220$/)?.[1];
  const clear=fieldKey=>{
   const target=get(fieldKey),hint=form.querySelector(`[data-contract-field-error220="${fieldKey}"]`);
   if(hint){hint.hidden=true;hint.textContent='';}
   target?.removeAttribute('aria-invalid');
   target?.removeAttribute('aria-errormessage');
  };
  if(key)clear(key);
  if(key==='startDate'||event.target===term)clear('endDate');
  updatePreview();
 });
 form.addEventListener('change',updatePreview);
 updatePreview();
 function close(){
  root.classList.remove('show');root.innerHTML='';
  if(origin?.isConnected)origin.focus();
 }
 function cancelEdit(){
  if(busy||lease?.busy())return;
  if((snapshot()!==initial||lease?.hasUnsaved())&&!window.confirm('合約尚未儲存，確定捨棄變更？'))return;
  close();
 }
 cancel.onclick=cancelEdit;
 modal.querySelector('[data-close]').onclick=cancelEdit;
 root.onclick=event=>{if(event.target===root)cancelEdit();};
 modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();cancelEdit();}});
 async function commit(action,notice=null) {
  if(busy)return;
  busy=true;
  error.hidden=true;
  const leaseError=$('#leaseError224');
  if(leaseError)leaseError.hidden=true;
  for(const node of form.querySelectorAll('[data-contract-field-error220]')){node.hidden=true;node.textContent='';}
  form.querySelectorAll('[aria-invalid]').forEach(node=>node.removeAttribute('aria-invalid'));
  const fields=collect(),stay=action==='save'&&lease&&lease.active()!=='basic'&&!detach?.checked;
  const categoryName=fields.categoryId==='__new'?get('categoryName').value:'';
  const controls=[...modal.querySelectorAll('input,textarea,select,button')].filter(node=>!node.disabled);
  controls.forEach(node=>node.disabled=true);
  const wasNew=!existing;
  let saved;
  try{
   if(action==='save'){
    if(fields.categoryId==='__new')contractEngine220.categoryFor(categoryName);
    const costs=lease?lease.collect():leaseEngine224.updateDeposit(
     leaseEngine224.updateOpeningRent(renewalCosts?{...renewalCosts,steps:[]}:undefined,fields.startDate,get('monthlyRent').value,get('rentBasis').value),
     fields.startDate,get('deposit').value);
    if(costs)fields.lease=costs;
    if(notice)fields.leaseNotices=[...(fields.leaseNotices||[]),notice];
   }
   saved=await writeContract220({id:draft.id,draft:fields,baseline:existing,categoryName,action,renewalFrom,detachPrevious:detach?.checked});
  }catch(failure){
   const key=failure.field,target=key?get(key):null;
   const hint=key?form.querySelector(`[data-contract-field-error220="${key}"]`):null;
   if(target&&hint){
    lease?.activate('basic');
    if(rentPanel?.contains(target))rentPanel.open=true;
    if(depositPanel?.contains(target))depositPanel.open=true;
    hint.textContent=failure.message;hint.hidden=false;hint.id='contract-field-error-'+key+'220';
    target.setAttribute('aria-invalid','true');target.setAttribute('aria-errormessage',hint.id);
   }
   else{
    if(lease&&key==='deposit')lease.activate('deposit');
    const message=lease&&lease.active()!=='basic'?leaseError:error;
    message.textContent=failure.message||'合約未能儲存';
    message.hidden=false;
   }
   busy=false;controls.forEach(node=>node.disabled=false);
   (target&&hint?target:lease&&lease.active()!=='basic'?leaseError:error).focus();
   return;
  }
  if(!stay)close();
  else{
   existing=saved;
   lease.saved(saved);
  }
  if(action==='save'&&state.view==='contracts'&&(wasNew||clientMissing||categoryMissing||previousMissing)){
   revealSavedContracts237([saved],{focusClient:!!renewalFrom});
  }
  try{
   await loadAll();
   if(stay){
    get('categoryId').innerHTML=contractTypeOptions220(saved.categoryId)+'<option value="__new">＋ 新增類別</option>';
    get('categoryName').value='';
    updatePreview();
    initial=snapshot();
   }else if(state.view==='contracts'&&!origin?.isConnected){
    const next=$$('#contractsList220 [data-open-contract220]').find(button=>button.dataset.openContract220===draft.id);
    (next||$('#newContract220'))?.focus({preventScroll:true});
   }
   toast(action==='delete'?'已刪除合約':renewalFrom?'續約已儲存':notice?'已存入通知紀錄':stay?'租約費用已儲存':'合約已儲存');
  }catch{toast('變更已儲存，請重新整理工作台');}
  finally{
   busy=false;controls.forEach(node=>{if(node.isConnected)node.disabled=false;});
   if(stay)(notice?$('#leaseRecordNotice228'):save)?.focus({preventScroll:true});
  }
 }
 save.onclick=()=>commit('save');
 form.onsubmit=event=>{event.preventDefault();commit('save');};
 if(existing){
  const remove=vatElement214('button','btn danger','刪除合約');
  remove.type='button';remove.id='deleteContract220';
  remove.onclick=()=>{if(!busy&&window.confirm(existing.previousContractId?'確定刪除這一期？上期會恢復原有狀態與提醒。':'確定刪除合約及其到期提醒？'))commit('delete');};
  footer.prepend(remove);
 }
 if(lease&&initialPane==='setup'){
  lease.activate('setup');
  $('#lease-tab-setup').focus();
 }else get('title')?.focus();
}

function contractReminderEvents220() {
 const records=contracts220(),successors=contractEngine220.successors(records);
 return records.filter(row=>contractDue220(row,successors.has(row.id)))
  .sort((a,b)=>a.endDate.localeCompare(b.endDate)||a.id.localeCompare(b.id))
  .map(row=>{
   const customer=clientById(row.clientId);
   return {id:'contract-task:'+row.id,source:'contract',contractId:row.id,clientId:row.clientId,label:'合約到期待辦',client:customer?.name||'客戶已移除',
    code:customer?.code||'',detail:row.title+' · '+row.task,effectiveDate:row.endDate,priority:'today',tone:'orange'};
  });
}
function rentChangeReminderEvents233(){
 const today=localDate();
 return contracts220().filter(contractRefsReady237).flatMap(contract=>leaseEngine224.rentChanges(contract.lease)
  .filter(change=>contractEngine220.rentReminderDue(contract,change,today))
  .map(change=>{
   const customer=clientById(contract.clientId);
   return {id:'rent-task:'+contract.id+':'+change.date,source:'contract',contractId:contract.id,clientId:contract.clientId,
    client:customer?.name||'客戶已移除',code:customer?.code||'',label:rentChangeLabel233(change),
    detail:contract.title+' · '+fmtDate(change.date)+' 生效 · '+rentChangeAmounts233(change),effectiveDate:change.date,rentChange:change,priority:'today',tone:'orange'};
  }));
}
function rentReminderActions233(contractId,date,{compact=false,due=true}={}){
 const dateLabel=fmtDate(date);
 return `<button type="button" class="${compact?'today-link226':'btn small'}" data-open-rent-change233="${esc(contractId)}" aria-label="查看 ${esc(dateLabel)} 調租">查看${compact?' <span aria-hidden="true">›</span>':'調租'}</button>
  ${due?`<button type="button" class="${compact?'today-complete226':'btn small'}" data-confirm-rent-change233="${esc(contractId)}"
   data-rent-effective233="${esc(date)}" aria-label="確認 ${esc(dateLabel)} 調租提醒" title="確認調租提醒">${compact?'<span aria-hidden="true">✓</span>':'確認提醒'}</button>`:''}`;
}
function contractCalendarItems220() {
 const rows=[],records=contracts220(),successors=contractEngine220.successors(records);
 for(const contract of records){
  const renewed=successors.has(contract.id),ready=contractRefsReady237(contract);
  const base={source:'contract',contractId:contract.id,clientId:contract.clientId,contractStatus:contractEngine220.status(contract,localDate(),renewed),time:''};
  const reminderDate=contractReminderDate220(contract);
  const schedule={reminderEnabled:ready&&contract.reminderEnabled&&!contract.closed&&!renewed,reminderDate,reminderCompletedAt:contract.taskCompletedAt};
  const sameDay=contract.endDate===reminderDate;
  const suffix=renewed?'（已續約）':contract.closed?'（已結案）':'';
  rows.push({...base,...schedule,id:'contract-end:'+contract.id,date:contract.endDate,
   reminderEnabled:sameDay&&schedule.reminderEnabled,content:'合約到期｜'+contract.title+suffix});
  if(schedule.reminderEnabled&&!sameDay)rows.push({...base,...schedule,id:'contract-reminder:'+contract.id,date:reminderDate,
   content:'合約提醒｜'+contract.title+' · '+contract.task});
  for(const change of leaseEngine224.rentChanges(contract.lease)){
   const notify=contract.closed||!ready?'':contractEngine220.rentReminderDate(change),sameDay=notify===change.date;
   const description=rentChangeLabel233(change)+'｜'+contract.title+' · '+rentChangeAmounts233(change);
   const reminderState={rentChange:change,reminderDate:notify,reminderCompletedAt:change.doneAt};
   const key=contract.id+':'+change.date;
   rows.push({...base,...reminderState,id:'rent-effective:'+key,date:change.date,reminderEnabled:sameDay,content:description});
   if(notify&&!sameDay)rows.push({...base,...reminderState,id:'rent-reminder:'+key,date:notify,reminderEnabled:true,
    content:'調租提醒｜'+description+' · '+fmtDate(change.date)+' 生效'});
  }
 }
 return rows;
}
function openContractCalendar220(id) {
 const contract=contractID220(id);
 if(!contract)return;
 switchView('calendar');
 if(state.view!=='calendar')return;
 state.calendarFilters={q:'',clientId:contract.clientId,from:'',to:''};
 state.calendarMonth=contract.endDate.slice(0,7);
 renderCalendar();
 openCalendarDrawer(contract.endDate);
}
const contractTaskBusy220=new Set();
async function updateContractTask220(id,action,effectiveDate='') {
 const before=contractID220(id);
 if(!before||contractTaskBusy220.has(id))return;
 contractTaskBusy220.add(id);
 const toggleButtons=disabled=>$$('[data-contract-complete220],[data-contract-reopen220],[data-confirm-rent-change233]').forEach(button=>{
  if((button.dataset.contractComplete220||button.dataset.contractReopen220||button.dataset.confirmRentChange233)===id)button.disabled=disabled;
 });
 toggleButtons(true);
 try{
  await writeContract220({id,baseline:before,action,effectiveDate});
  await loadAll();
  if($('#calendarDrawer')?.classList.contains('show'))openCalendarDrawer(state.calendarSelectedDate);
  toast(action==='rent-confirm'?'調租提醒已確認':action==='complete'?'合約待辦已完成':'合約待辦已重開');
 }catch(error){toast(error.message||'待辦未能儲存');}
 finally{contractTaskBusy220.delete(id);toggleButtons(false);}
}
function bindContractActions220(root) {
 if(!root)return;
 for(const [attr,action] of [
  ['leaseBatch228',id=>openLeaseBatch228(id)],['openContract220',id=>openContract220(id)],['contractRenew221',id=>{const source=contractID220(id);if(source)openContract220(null,source);}],['contractCalendar220',id=>openContractCalendar220(id)],
  ['contractComplete220',id=>updateContractTask220(id,'complete')],['contractReopen220',id=>updateContractTask220(id,'reopen')],
  ['openRentChange233',id=>openContract220(id,null,'setup')],['confirmRentChange233',(id,button)=>updateContractTask220(id,'rent-confirm',button.dataset.rentEffective233)]
 ]){
  const selector='[data-'+attr.replace(/[A-Z]/g,char=>'-'+char.toLowerCase())+']';
  root.querySelectorAll(selector).forEach(button=>button.onclick=event=>{event.stopPropagation();action(button.dataset[attr],button);});
 }
}
function renderContractReminderStrip220(){
 const strip=$('#contractReminderStrip220');
 if(!strip)return;
 const due=[...contractReminderEvents220(),...rentChangeReminderEvents233()].sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate)),groups=new Map();
 for(const event of due.slice(0,3)){
  if(!groups.has(event.clientId))groups.set(event.clientId,{name:event.client,items:[]});
  groups.get(event.clientId).items.push(event);
 }
 strip.innerHTML=`<header class="today-reminder-heading226">
  <h2 id="todayContractsTitle226">合約提醒 <span class="badge b-orange">${due.length}</span></h2>
  ${due.length>3?'<button class="today-link226" id="allContractTodos220" type="button">查看全部</button>':''}
 </header>
 ${groups.size?`<ul class="today-reminder-list226">${[...groups.values()].map(group=>`<li class="today-contract-group226">
  <strong class="today-reminder-client226">${esc(group.name)}</strong>
  <ul>${group.items.map(event=>{
   const contract=contractID220(event.contractId),change=event.rentChange;
   return `<li class="today-contract-row226">
   ${change?`<div class="today-contract-caption226"><span>${esc(contract.title)} · ${esc(event.label)}</span>
    <time datetime="${esc(change.date)}">${esc(fmtDate(change.date))} 生效</time></div>
    ${rentReminderActions233(contract.id,change.date,{compact:true})}`:`
   <div class="today-contract-caption226"><span>${esc(contract.title)}</span><time datetime="${esc(contract.endDate)}">${esc(fmtDate(contract.endDate))}</time></div>
   <button type="button" class="today-link226" data-open-contract220="${esc(contract.id)}" aria-label="查看合約 · ${esc(contract.title)}">查看 <span aria-hidden="true">›</span></button>
   <button type="button" class="today-complete226" data-contract-complete220="${esc(contract.id)}" aria-label="完成待辦 · ${esc(contract.title)}" title="完成待辦"><span aria-hidden="true">✓</span></button>
   `}</li>`;
  }).join('')}</ul>
 </li>`).join('')}</ul>`:'<p class="today-reminder-empty226">目前沒有合約提醒</p>'}`;
 $('#allContractTodos220')?.addEventListener('click',()=>$('#todaySystemTab210')?.click());
}

const calendarItemsBefore220=calendarAllItems;
calendarAllItems=function(){return [...calendarItemsBefore220(),...contractCalendarItems220()];};
const calendarClientBefore220=calendarItemClient;
calendarItemClient=function(event){return event?.source==='contract'?clientById(event.clientId)||{name:'客戶已移除',code:''}:calendarClientBefore220(event);};
const noteCardBefore220=noteCardHtml;
noteCardHtml=function(event){
 if(event.source!=='contract')return noteCardBefore220(event);
 const customer=calendarItemClient(event),contract=contractID220(event.contractId);
 const change=event.rentChange;
 const actions=change?rentReminderActions233(contract.id,change.date,{due:contractRefsReady237(contract)&&contractEngine220.rentReminderDue(contract,change,localDate())}):`
  <button class="btn small" type="button" data-open-contract220="${esc(contract.id)}">查看合約</button>
  ${event.reminderEnabled&&contractDue220(contract)?`<button class="btn small" type="button" data-contract-complete220="${esc(contract.id)}">完成待辦</button>`:''}`;
 return `<div class="note-card case-calendar219 ${calendarReminderClass(event)}" data-contract-calendar-item220="${esc(event.id)}">
  <div class="note-time">整日</div><div><div class="note-client">${esc(customer.name)} <span class="work-linked-tag">合約</span></div>
  <div class="note-content">${esc(event.content)}</div>${contractBadge220(event.contractStatus)}
  ${event.reminderEnabled?`<div class="small muted">${esc(change?(change.doneAt?'調租提醒已確認':'調租提醒'):contractTaskLabel220(contract))}</div>`:''}</div>
  <div class="note-actions">${actions}</div></div>`;
};
const bindCalendarBefore220=bindCalendarNoteActions;
bindCalendarNoteActions=function(){
 bindCalendarBefore220();
 bindContractActions220($('#view-calendar'));
 bindContractActions220($('#calendarDrawer'));
};
const reminderEventsBefore220=calendarReminderEvents;
calendarReminderEvents=function(){return [...reminderEventsBefore220(),...contractReminderEvents220(),...rentChangeReminderEvents233()];};
const todayBefore220=renderToday;
renderToday=function(){const result=todayBefore220();renderContractReminderStrip220();bindContractActions220($('#view-today'));return result;};
const renderBefore220=renderAll;
renderAll=function(){const result=renderBefore220();if(state.view==='contracts')renderContracts220();return result;};
const switchBefore220=switchView;
switchView=function(view){const result=switchBefore220(view);if(state.view==='contracts')renderContracts220();return result;};
