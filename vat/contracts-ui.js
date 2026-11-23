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
const contractDue220=(row,renewed=!!nextContract220(row.id))=>contractEngine220.isDue(row,localDate(),renewed);

function writeContract220({id,draft,baseline=null,categoryName='',action='save',renewalFrom=null}) {
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
    if(action==='complete'||action==='reopen'){
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
     result=contractEngine220.save({draft:next,current:before,baseline,clients:clients.result,categories:options,at,previousContractId:renewalFrom?.id||before?.previousContractId});
    }
    contractEngine220.validateLinks([...rows.filter(row=>row.id!==id),result]);
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
function mountContracts220() {
 const view=$('#view-contracts');
 if(!view||$('#contractsList220'))return;
 view.innerHTML=`<div class="page-head"><h1 class="page-title">租約與合約</h1>
  <div class="actions"><button class="btn" type="button" id="leaseRatesBtn224">年度郵政利率</button><button class="btn primary" type="button" id="newContract220">新增合約</button></div></div>
 <div class="contract-stats220" id="contractStats220" aria-label="合約狀態"></div>
 <div class="contract-filters220">
  <div class="field"><label for="contractSearch220">搜尋</label><input id="contractSearch220" class="input" type="search" placeholder="名稱、客戶或備註"></div>
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
 for(const item of all)counts[item.status]++;
 const stats=$('#contractStats220');
 stats.innerHTML=Object.entries(contractStatus220).map(([key,[label,tone]])=>
  `<button class="cases-stat219 ${runtime.status===key?'active':''}" type="button" data-contract-status220="${key}" aria-pressed="${runtime.status===key}">${statusBadge(label,tone)}<strong>${counts[key]}</strong></button>`).join('');
 stats.querySelectorAll('[data-contract-status220]').forEach(button=>button.onclick=()=>{
  const key=button.dataset.contractStatus220;
  Object.assign(runtime,{status:runtime.status===key?'all':key,page:1});
  renderContracts220();
  stats.querySelector(`[data-contract-status220="${key}"]`)?.focus();
 });
 const clientFilter=$('#contractClientFilter220'),categoryFilter=$('#contractCategoryFilter220');
 clientFilter.innerHTML='<option value="">全部客戶</option>'+recordClientOptions220(runtime.clientId);
 categoryFilter.innerHTML='<option value="">全部類別</option>'+contractTypeOptions220(runtime.categoryId);
 $('#contractStatusFilter220').value=runtime.status;
 const filtered=all.filter(({row,status})=>{
  if(runtime.status!=='all'&&runtime.status!==status)return false;
  if(runtime.clientId&&runtime.clientId!==row.clientId)return false;
  if(runtime.categoryId&&runtime.categoryId!==row.categoryId)return false;
  if(runtime.year&&!row.endDate.startsWith(runtime.year+'-'))return false;
  const customer=clientById(row.clientId);
  return !query||[row.title,row.note,row.task,contractTypeName220(row.categoryId),customer?.code,customer?.name].join(' ').toLocaleLowerCase().includes(query);
 }).sort((a,b)=>Number(['closed','renewed'].includes(a.status))-Number(['closed','renewed'].includes(b.status))||a.row.endDate.localeCompare(b.row.endDate)||a.row.id.localeCompare(b.row.id));
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
   row.taskCompletedAt&&!row.closed&&!next&&row.reminderEnabled?`<button class="btn" type="button" data-contract-reopen220="${esc(row.id)}">重開待辦</button>`:'';
  return {id:row.id,keyAttribute:'data-contract-id220',
   cells:[
    `<h2>${esc(row.title)}</h2><small>${esc(type)}</small>${rent?`<span class="contract-rent-amount225">${esc(rent.label)} <strong>${esc(rent.value)}</strong></span>`:''}`,
    contractBadge220(status),
    `<strong>${esc(fmtDate(row.endDate))}</strong><small>${esc(next?'下一期 '+fmtDate(next.startDate):due?'待辦未完成':row.taskCompletedAt?'待辦已完成':row.reminderEnabled&&!row.closed?'提醒 '+reminder:'')}</small>`,
    `<button class="btn" type="button" data-open-contract220="${esc(row.id)}">查看合約</button>
     ${isLease?`<button class="btn" type="button" data-open-lease224="${esc(row.id)}">租金與押息</button>`:''}
     ${!next&&contractEngine220.shiftDay(row.endDate,1)?`<button class="btn" type="button" data-contract-renew221="${esc(row.id)}">續約</button>`:''}`
   ],
   schedule:[['開始',row.startDate?fmtDate(row.startDate):'',row.startDate],['到期',fmtDate(row.endDate),row.endDate],['提醒',reminder,contractReminderDate220(row)]],
   extra:leaseSummary224(row),
   facts:[['提醒狀態',row.reminderEnabled?taskStatus:''],['待辦',row.reminderEnabled?row.task:''],
    ...(previous?[['上期合約',previous.title+' · '+fmtDate(previous.endDate)]]:[]),
    ...(next?[['續約期間',fmtDate(next.startDate)+' ～ '+fmtDate(next.endDate)]]:[])],note:row.note,
   detailActions:`<div class="record-detail-actions220"><button class="btn" type="button" data-contract-calendar220="${esc(row.id)}">查看日曆</button>${previous?`<button class="btn" type="button" data-open-contract220="${esc(previous.id)}">查看上期</button>`:''}${next?`<button class="btn" type="button" data-open-contract220="${esc(next.id)}">查看續約</button>`:''}${action}</div>`
  };
 };
 const count=clientFolders222({host,pager:$('#contractPagination220'),runtime,matched:filtered.map(item=>item.row),all:records,kind:'合約',
  columns:['合約／類別','狀態','到期／提醒','操作'],makeRow,render:renderContracts220,bind:bindContractActions220});
 $('#contractCount220').textContent=`${count} 位客戶 · ${filtered.length} 筆合約`;
}

function openContract220(id,renewalFrom=null) {
 const existing=id?contractID220(id):null;
 if(id&&!existing){toast('合約已被刪除，請重新整理');return;}
 if(!existing&&!state.clients.length){toast('請先在客戶庫新增客戶');return;}
 const renewalStart=renewalFrom?contractEngine220.shiftDay(renewalFrom.endDate,1):'';
 if(renewalFrom&&(!renewalStart||nextContract220(renewalFrom.id))){toast('此合約無法再從這一期續約');return;}
 const draft=existing?clone(existing):{id:uid('contract'),clientId:'',categoryId:'lease',title:'',startDate:'',endDate:'',leadMonths:1,
  closed:false,reminderEnabled:true,task:'確認續約或結案',note:''};
 if(draft.lease)draft.lease=leaseEngine224.normalize(draft.lease,draft.startDate,draft.endDate);
 if(renewalFrom)Object.assign(draft,{
  clientId:renewalFrom.clientId,categoryId:renewalFrom.categoryId,title:renewalFrom.title,
  startDate:renewalStart,endDate:contractEngine220.termEnd(renewalStart,1),
  leadMonths:renewalFrom.leadMonths,reminderEnabled:renewalFrom.reminderEnabled,task:renewalFrom.task
 });
 const root=$('#modalRoot');
 const field=(key,label,contents)=>`<div class="field"><label for="contract-${key}220">${label}</label>${contents}
  <span class="contract-field-error220" data-contract-field-error220="${key}" hidden></span></div>`;
 const input=(key,type,value,extra='')=>`<input id="contract-${key}220" class="input" type="${type}" value="${esc(value)}" ${extra}>`;
 const customer=`<select class="select" id="contract-clientId220" required><option value="">選擇客戶</option>${recordClientOptions220(draft.clientId)}</select>`;
 const category=`<select class="select" id="contract-categoryId220">${contractTypeOptions220(draft.categoryId)}<option value="__new">＋ 新增類別</option></select>`;
 showModal(renewalFrom?'續約':existing?'合約明細':'新增合約',`<form id="contractForm220" class="cases-form219 record-form222" novalidate>
  ${renewalFrom?`<p class="cases-span219 contract-renew-info221">上期到期日 <strong>${esc(fmtDate(renewalFrom.endDate))}</strong></p>`:''}
  <div class="cases-span219">${field('title','合約名稱',input('title','text',draft.title,'required maxlength="200"'))}</div>
  ${field('clientId','客戶',customer)}${field('categoryId','類別',category)}
  <div class="cases-span219" id="contractNewCategory220" hidden>${field('categoryName','新類別名稱',input('categoryName','text','','maxlength="32"'))}</div>
  <div class="record-client-inline222 cases-span219" id="contractClientPreview220" hidden></div>
  ${renewalFrom?`<div class="field cases-span219"><label for="contractRenewTerm221">續約期限</label><select class="select" id="contractRenewTerm221">
   <option value="1">1 年</option><option value="2">2 年</option><option value="3">3 年</option><option value="">自訂到期日</option></select></div>`:''}
  ${field('startDate',renewalFrom?'新約開始日期':'開始日期（選填）',input('startDate','date',draft.startDate))}
  ${field('endDate','到期日',input('endDate','date',draft.endDate,'required'))}
  <details class="record-settings222 contract-rent-settings225 cases-span219" id="contractRent225" ${draft.categoryId==='lease'||draft.lease?'open':''}>
   <summary>租金設定</summary>
   <div class="contract-rent-fields225">
    ${field('monthlyRent','月租（元）',input('monthlyRent','text',leaseEngine224.format(draft.lease?.steps[0]?.cents),'inputmode="decimal"'))}
    ${field('rentBasis','金額基準',`<select id="contract-rentBasis220" class="select">${[['net','未稅'],['gross','含稅']].map(([key,label])=>leaseOption224(key,label,draft.lease?.rentBasis||'net')).join('')}</select>`)}
    ${draft.lease?.steps.length>1?`<span class="contract-rent-count225">首段月租 · 共 ${draft.lease.steps.length} 段</span>`:''}
   </div>
  </details>
  <div class="record-settings222 cases-span219">
   <div class="record-setting-head222">
    <label class="cases-check219 record-toggle222"><input id="contract-reminderEnabled220" type="checkbox" ${draft.reminderEnabled?'checked':''}>到期提醒</label>
    <span class="record-preview-date222" id="contractPreviewDate220" aria-live="polite"></span>
   </div>
   <div class="contract-reminder-inputs222" id="contractReminderFields222" ${draft.reminderEnabled?'':'hidden'}>
    ${field('leadMonths','提前月數',input('leadMonths','number',draft.leadMonths,'min="0" max="36" step="1" aria-describedby="contractPreviewDate220"'))}
    ${field('task','待辦事項',input('task','text',draft.task,'maxlength="240"'))}
   </div>
  </div>
  <div class="cases-span219 field"><label for="contract-note220">備註</label><textarea class="textarea" id="contract-note220" maxlength="12000" rows="2">${esc(draft.note)}</textarea></div>
  ${renewalFrom?'<input id="contract-closed220" type="checkbox" hidden>':`<label class="cases-check219"><input id="contract-closed220" type="checkbox" ${draft.closed?'checked':''}>已結案</label>`}
  ${!renewalFrom&&existing&&!nextContract220(existing.id)&&contractEngine220.shiftDay(existing.endDate,1)?'<button class="btn" type="button" id="renewFromDetail221">續約</button>':''}
  <p class="notice warn cases-span219" id="contractError220" role="alert" tabindex="-1" hidden></p>
 </form>`,[{text:'取消',value:false},{text:renewalFrom?'確認續約':'儲存合約',value:true,cls:'primary'}],()=>{});
 const modal=root.querySelector('.modal'),form=$('#contractForm220'),error=$('#contractError220');
 modal.classList.add('cases-modal219','contract-modal220','record-modal222');
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
  ...(draft.lease?{lease:draft.lease}:{})});
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
 const rentPanel=$('#contractRent225');
 get('categoryId').addEventListener('change',()=>{
  rentPanel.open=get('categoryId').value==='lease'||!!draft.lease||!!get('monthlyRent').value.trim();
 });
 const snapshot=()=>JSON.stringify([collect(),get('categoryName').value,term?.value,get('monthlyRent').value,get('rentBasis').value]);
 const initial=snapshot(),origin=document.activeElement;
 let busy=false;
 function updatePreview(){
  const requiresStart=!!renewalFrom||!!get('monthlyRent').value.trim()||!!draft.lease;
  get('startDate').required=requiresStart;
  if(!renewalFrom)form.querySelector('label[for="contract-startDate220"]').textContent=requiresStart?'開始日期（必填）':'開始日期（選填）';
  $('#contractNewCategory220').hidden=get('categoryId').value!=='__new';
  const customer=clientById(get('clientId').value),preview=$('#contractClientPreview220');
  const facts=recordClientFacts222(customer);
  preview.hidden=!facts;
  preview.innerHTML=facts;
  let date='';
  try{date=contractEngine220.reminderDate(get('endDate').value,get('leadMonths').value);}catch{}
  $('#contractReminderFields222').hidden=!get('reminderEnabled').checked;
  $('#contractPreviewDate220').textContent=get('reminderEnabled').checked&&date?'提醒日 '+fmtDate(date):'';
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
  if(busy)return;
  if(snapshot()!==initial&&!window.confirm('合約尚未儲存，確定捨棄變更？'))return;
  close();
 }
 const renewButton=$('#renewFromDetail221');
 if(renewButton)renewButton.onclick=()=>{
  if(busy||snapshot()!==initial&&!window.confirm('尚未儲存的改動會捨棄，要改為續約嗎？'))return;
  close();
  openContract220(null,existing);
 };
 cancel.onclick=cancelEdit;
 modal.querySelector('[data-close]').onclick=cancelEdit;
 root.onclick=event=>{if(event.target===root)cancelEdit();};
 modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();cancelEdit();}});
 async function commit(action) {
  if(busy)return;
  busy=true;
  error.hidden=true;
  for(const node of form.querySelectorAll('[data-contract-field-error220]')){node.hidden=true;node.textContent='';}
  form.querySelectorAll('[aria-invalid]').forEach(node=>node.removeAttribute('aria-invalid'));
  const fields=collect();
  const categoryName=fields.categoryId==='__new'?get('categoryName').value:'';
  const controls=[...modal.querySelectorAll('input,textarea,select,button')].filter(node=>!node.disabled);
  controls.forEach(node=>node.disabled=true);
  try{
   if(action==='save'){
    if(fields.categoryId==='__new')contractEngine220.categoryFor(categoryName);
    const lease=leaseEngine224.updateOpeningRent(draft.lease,fields.startDate,get('monthlyRent').value,get('rentBasis').value);
    if(lease)fields.lease=lease;
   }
   await writeContract220({id:draft.id,draft:fields,baseline:existing,categoryName,action,renewalFrom});
  }catch(failure){
   busy=false;controls.forEach(node=>node.disabled=false);
   const key=failure.field,target=key?get(key):null;
   const hint=key?form.querySelector(`[data-contract-field-error220="${key}"]`):null;
   if(target&&hint){
    if(rentPanel.contains(target))rentPanel.open=true;
    hint.textContent=failure.message;hint.hidden=false;hint.id='contract-field-error-'+key+'220';
    target.setAttribute('aria-invalid','true');target.setAttribute('aria-errormessage',hint.id);target.focus();
   }else{error.textContent=failure.message||'合約未能儲存';error.hidden=false;error.focus();}
   return;
  }
  close();
  if(renewalFrom&&state.view==='contracts'){
   Object.assign(contractRuntime220,{query:'',status:'all',year:'',categoryId:'',clientId:renewalFrom.clientId,page:1});
   $('#contractSearch220').value='';
  }
  try{
   await loadAll();
   if(state.view==='contracts'&&!origin?.isConnected){
    const next=$$('#contractsList220 [data-open-contract220]').find(button=>button.dataset.openContract220===draft.id);
    (next||$('#newContract220'))?.focus({preventScroll:true});
   }
   toast(action==='delete'?'已刪除合約':renewalFrom?'續約已儲存':'合約已儲存');
  }
  catch{toast('變更已儲存，請重新整理工作台');}
 }
 save.onclick=()=>commit('save');
 form.onsubmit=event=>{event.preventDefault();commit('save');};
 if(existing){
  const remove=vatElement214('button','btn danger','刪除合約');
  remove.type='button';remove.id='deleteContract220';
  remove.onclick=()=>{if(!busy&&window.confirm(existing.previousContractId?'確定刪除這一期？上期會恢復原有狀態與提醒。':'確定刪除合約及其到期提醒？'))commit('delete');};
  footer.prepend(remove);
 }
 get('title')?.focus();
}

function contractReminderEvents220() {
 const today=localDate();
 const records=contracts220(),successors=contractEngine220.successors(records);
 return records.filter(row=>contractEngine220.isDue(row,today,successors.has(row.id)))
  .sort((a,b)=>a.endDate.localeCompare(b.endDate)||a.id.localeCompare(b.id))
  .map(row=>{
   const customer=clientById(row.clientId);
   return {id:'contract-task:'+row.id,source:'contract',contractId:row.id,label:'合約到期待辦',client:customer?.name||'客戶已移除',
    code:customer?.code||'',detail:row.title+' · '+row.task,priority:'today',tone:'orange'};
  });
}
function contractCalendarItems220() {
 const rows=[],records=contracts220(),successors=contractEngine220.successors(records);
 for(const contract of records){
  const renewed=successors.has(contract.id);
  const base={source:'contract',contractId:contract.id,clientId:contract.clientId,contractStatus:contractEngine220.status(contract,localDate(),renewed),time:''};
  const reminderDate=contractReminderDate220(contract);
  const schedule={reminderEnabled:contract.reminderEnabled&&!contract.closed&&!renewed,reminderDate,reminderCompletedAt:contract.taskCompletedAt};
  const sameDay=contract.endDate===reminderDate;
  const suffix=renewed?'（已續約）':contract.closed?'（已結案）':'';
  rows.push({...base,...schedule,id:'contract-end:'+contract.id,date:contract.endDate,
   reminderEnabled:sameDay&&schedule.reminderEnabled,content:'合約到期｜'+contract.title+suffix});
  if(schedule.reminderEnabled&&!sameDay)rows.push({...base,...schedule,id:'contract-reminder:'+contract.id,date:reminderDate,
   content:'合約提醒｜'+contract.title+' · '+contract.task});
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
async function updateContractTask220(id,action) {
 const before=contractID220(id);
 if(!before||contractTaskBusy220.has(id))return;
 contractTaskBusy220.add(id);
 const toggleButtons=disabled=>$$('[data-contract-complete220],[data-contract-reopen220]').forEach(button=>{
  if((button.dataset.contractComplete220||button.dataset.contractReopen220)===id)button.disabled=disabled;
 });
 toggleButtons(true);
 try{
  await writeContract220({id,baseline:before,action});
  await loadAll();
  if($('#calendarDrawer')?.classList.contains('show'))openCalendarDrawer(state.calendarSelectedDate);
  toast(action==='complete'?'合約待辦已完成':'合約待辦已重開');
 }catch(error){toast(error.message||'待辦未能儲存');}
 finally{contractTaskBusy220.delete(id);toggleButtons(false);}
}
function bindContractActions220(root) {
 if(!root)return;
 for(const [attr,action] of [
  ['openLease224',id=>openLease224(id)],['openContract220',id=>openContract220(id)],['contractRenew221',id=>{const source=contractID220(id);if(source)openContract220(null,source);}],['contractCalendar220',id=>openContractCalendar220(id)],
  ['contractComplete220',id=>updateContractTask220(id,'complete')],['contractReopen220',id=>updateContractTask220(id,'reopen')]
 ]){
  const selector='[data-'+attr.replace(/[A-Z]/g,char=>'-'+char.toLowerCase())+']';
  root.querySelectorAll(selector).forEach(button=>button.onclick=event=>{event.stopPropagation();action(button.dataset[attr]);});
 }
}
function renderContractReminderStrip220() {
 const pane=$('#workTaskPane210'),tabs=$('.today-view-tabs210');
 if(!pane||!tabs)return;
 let strip=$('#contractReminderStrip220');
 if(!strip){
  strip=document.createElement('section');
  strip.id='contractReminderStrip220';strip.className='contract-reminder-strip220';
  strip.setAttribute('aria-label','合約到期待辦');
  ($('#caseReminderStrip219')||tabs).after(strip);
 }
 const due=contractReminderEvents220();
 strip.hidden=pane.hidden||!due.length;
 if(strip.hidden){strip.replaceChildren();return;}
 strip.innerHTML=`<div class="contract-todo-heading220"><strong>合約到期待辦 <span class="badge b-orange">${due.length}</span></strong>
  ${due.length>3?'<button class="btn small" id="allContractTodos220" type="button">查看全部</button>':''}</div>
  ${due.slice(0,3).map(event=>`<div class="contract-todo-row220"><div><strong>${esc(event.client)}</strong><div>${esc(event.detail)}</div></div>
  <div class="actions"><button class="btn small" type="button" data-open-contract220="${esc(event.contractId)}">查看合約</button>
  <button class="btn small primary" type="button" data-contract-complete220="${esc(event.contractId)}">完成待辦</button></div></div>`).join('')}`;
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
 return `<div class="note-card case-calendar219 ${calendarReminderClass(event)}" data-contract-calendar-item220="${esc(event.id)}">
  <div class="note-time">整日</div><div><div class="note-client">${esc(customer.name)} <span class="work-linked-tag">合約</span></div>
  <div class="note-content">${esc(event.content)}</div>${contractBadge220(event.contractStatus)}
  ${event.reminderEnabled?`<div class="small muted">${esc(contractTaskLabel220(contract))}</div>`:''}</div>
  <div class="note-actions"><button class="btn small" type="button" data-open-contract220="${esc(contract.id)}">查看合約</button>
  ${event.reminderEnabled&&contractDue220(contract)?`<button class="btn small" type="button" data-contract-complete220="${esc(contract.id)}">完成待辦</button>`:''}</div></div>`;
};
const bindCalendarBefore220=bindCalendarNoteActions;
bindCalendarNoteActions=function(){bindCalendarBefore220();bindContractActions220($('#view-calendar'));};
const reminderEventsBefore220=calendarReminderEvents;
calendarReminderEvents=function(){return [...reminderEventsBefore220(),...contractReminderEvents220()];};
const todayBefore220=renderToday;
renderToday=function(){const result=todayBefore220();renderContractReminderStrip220();bindContractActions220($('#view-today'));return result;};
const renderBefore220=renderAll;
renderAll=function(){const result=renderBefore220();if(state.view==='contracts')renderContracts220();return result;};
const switchBefore220=switchView;
switchView=function(view){const result=switchBefore220(view);if(state.view==='contracts')renderContracts220();return result;};
