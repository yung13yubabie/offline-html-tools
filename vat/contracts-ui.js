const contractEngine220=createContractsEngine220();
const contractRuntime220={query:'',clientId:'',categoryId:'',status:'all',page:1,size:12,expanded:new Set()};
const contractStatus220={
 upcoming:['即將到期','orange'],expired:['已到期','red'],active:['有效','green'],scheduled:['未生效','blue'],closed:['已結案','gray']
};
const contracts220=()=>state.contracts||[];
const customContractTypes220=()=>state.contractCategories||[];
const contractTypes220=()=>[...contractEngine220.builtins,...customContractTypes220().slice().sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'))];
const contractTypeName220=id=>contractTypes220().find(type=>type.id===id)?.name||'類別待核對';
const contractBadge220=status=>statusBadge(...contractStatus220[status]);
const contractID220=id=>contracts220().find(row=>row.id===id);
const contractReminderDate220=row=>contractEngine220.reminderDate(row.endDate,row.leadMonths);
const contractDue220=row=>contractEngine220.isDue(row,localDate());

function writeContract220({id,draft,baseline=null,categoryName='',action='save'}) {
 return new Promise((resolve,reject)=>{
  let transaction;
  try{transaction=db.transaction(['contracts','clients','contractCategories'],'readwrite');}
  catch(error){reject(error);return;}
  let failure,result,written=false;
  const contracts=transaction.objectStore('contracts'),types=transaction.objectStore('contractCategories');
  const current=contracts.get(id),clients=transaction.objectStore('clients').getAll(),categories=types.getAll();
  const write=()=>{
   if(written||[current,clients,categories].some(request=>request.readyState!=='done'))return;
   written=true;
   try{
    const before=current.result||null;
    if(action==='delete'){
     contractEngine220.assertBaseline(before,baseline);
     contracts.delete(id);
     return;
    }
    const at=nowISO();
    if(action==='complete'||action==='reopen'){
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
     result=contractEngine220.save({draft:next,current:before,baseline,clients:clients.result,categories:options,at});
    }
    contracts.put(result);
   }catch(error){failure=error;transaction.abort();}
  };
  for(const request of [current,clients,categories])request.onsuccess=write;
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
  <div class="actions"><button class="btn primary" type="button" id="newContract220">新增合約</button></div></div>
 <div class="contract-stats220" id="contractStats220" aria-label="合約狀態"></div>
 <div class="contract-filters220">
  <div class="field"><label for="contractSearch220">搜尋</label><input id="contractSearch220" class="input" type="search" placeholder="名稱、客戶或備註"></div>
  <div class="field"><label for="contractClientFilter220">客戶</label><select id="contractClientFilter220" class="select"></select></div>
  <div class="field"><label for="contractCategoryFilter220">類別</label><select id="contractCategoryFilter220" class="select"></select></div>
  <div class="field"><label for="contractStatusFilter220">狀態</label><select id="contractStatusFilter220" class="select"><option value="all">全部狀態</option>
   ${Object.entries(contractStatus220).map(([key,[label]])=>`<option value="${key}">${label}</option>`).join('')}</select></div>
  <button class="btn" type="button" id="contractClearFilter220">清除條件</button>
 </div>
 <div class="cases-result219" id="contractCount220" aria-live="polite"></div>
 <div id="contractsList220"></div><div id="contractPagination220"></div>`;
 $('#newContract220').onclick=()=>openContract220();
 for(const [selector,key,event] of [['#contractSearch220','query','input'],['#contractClientFilter220','clientId','change'],
  ['#contractCategoryFilter220','categoryId','change'],['#contractStatusFilter220','status','change']]){
  $(selector).addEventListener(event,ev=>{Object.assign(contractRuntime220,{[key]:ev.target.value,page:1});renderContracts220();});
 }
 $('#contractClearFilter220').onclick=()=>{
  Object.assign(contractRuntime220,{query:'',clientId:'',categoryId:'',status:'all',page:1});
  $('#contractSearch220').value='';
  renderContracts220();
 };
}
function contractTaskLabel220(row) {
 if(!row.reminderEnabled)return '未啟用';
 if(row.taskCompletedAt)return '已完成 '+fmtDateTime(row.taskCompletedAt);
 if(row.closed)return '已停止';
 return contractDue220(row)?'待處理':'尚未到提醒日';
}
function renderContracts220() {
 mountContracts220();
 const host=$('#contractsList220');
 if(!host)return;
 const runtime=contractRuntime220,today=localDate(),query=runtime.query.trim().toLocaleLowerCase();
 if(runtime.clientId&&!clientById(runtime.clientId))runtime.clientId='';
 if(runtime.categoryId&&!contractTypes220().some(type=>type.id===runtime.categoryId))runtime.categoryId='';
 const all=contracts220().map(row=>({row,status:contractEngine220.status(row,today)}));
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
  const customer=clientById(row.clientId);
  return !query||[row.title,row.note,row.task,contractTypeName220(row.categoryId),customer?.code,customer?.name].join(' ').toLocaleLowerCase().includes(query);
 }).sort((a,b)=>Number(a.status==='closed')-Number(b.status==='closed')||a.row.endDate.localeCompare(b.row.endDate)||a.row.id.localeCompare(b.row.id));
 runtime.page=Math.min(runtime.page,Math.max(1,Math.ceil(filtered.length/runtime.size)));
 const visible=filtered.slice((runtime.page-1)*runtime.size,runtime.page*runtime.size);
 $('#contractCount220').textContent=`共 ${filtered.length} 筆合約`;
 const rows=visible.map(({row,status})=>{
  const customer=clientById(row.clientId),type=contractTypeName220(row.categoryId);
  const reminder=row.reminderEnabled?fmtDate(contractReminderDate220(row)):'未啟用';
  const taskStatus=contractTaskLabel220(row);
  const action=contractDue220(row)?`<button class="btn primary" type="button" data-contract-complete220="${esc(row.id)}">完成待辦</button>`:
   row.taskCompletedAt&&!row.closed&&row.reminderEnabled?`<button class="btn" type="button" data-contract-reopen220="${esc(row.id)}">重開待辦</button>`:'';
  return {id:row.id,keyAttribute:'data-contract-id220',detailLabel:'完整資料',
   cells:[
    `<h2>${esc(row.title)}</h2><small>${esc(type)}</small>`,
    `<strong>${esc(customer?.name||'客戶已移除')}</strong><small>${esc(customer?.code||'')}</small>`,
    contractBadge220(status),
    `<strong>${esc(fmtDate(row.endDate))}</strong><small>${esc(contractDue220(row)?'待辦未完成':row.taskCompletedAt?'待辦已完成':row.reminderEnabled&&!row.closed?'提醒 '+reminder:'')}</small>`,
    `<button class="btn" type="button" data-open-contract220="${esc(row.id)}">查看合約</button>`
   ],
   facts:[['聯絡人',customer?contactSummary(customer):''],['地址',customer?.address],
    ['開始日期',row.startDate?fmtDate(row.startDate):''],['到期日',fmtDate(row.endDate)],
    ['提醒日期',reminder],['待辦狀態',taskStatus],['待辦事項',row.task],['備註',row.note]],
   detailActions:`<div class="record-detail-actions220"><button class="btn" type="button" data-contract-calendar220="${esc(row.id)}">查看日曆</button>${action}</div>`
  };
 });
 host.innerHTML=rows.length?recordList220(['合約／類別','客戶','狀態','到期／提醒','操作'],rows,runtime.expanded):
  `<div class="empty">${all.length?'沒有符合條件的合約':'尚無合約'}</div>`;
 bindRecordDetails220(host,runtime.expanded);
 recordPage220($('#contractPagination220'),runtime,filtered.length,renderContracts220,'合約');
 bindContractActions220(host);
}

function openContract220(id) {
 const existing=id?contractID220(id):null;
 if(id&&!existing){toast('合約已被刪除，請重新整理');return;}
 if(!existing&&!state.clients.length){toast('請先在客戶庫新增客戶');return;}
 const draft=existing?clone(existing):{id:uid('contract'),clientId:'',categoryId:'lease',title:'',startDate:'',endDate:'',leadMonths:1,
  closed:false,reminderEnabled:true,task:'確認續約或結案',note:''};
 const root=$('#modalRoot');
 const field=(key,label,contents)=>`<div class="field"><label for="contract-${key}220">${label}</label>${contents}
  <span class="contract-field-error220" data-contract-field-error220="${key}" hidden></span></div>`;
 const input=(key,type,value,extra='')=>`<input id="contract-${key}220" class="input" type="${type}" value="${esc(value)}" ${extra}>`;
 const customer=`<select class="select" id="contract-clientId220" required><option value="">選擇客戶</option>${recordClientOptions220(draft.clientId)}</select>`;
 const category=`<select class="select" id="contract-categoryId220">${contractTypeOptions220(draft.categoryId)}<option value="__new">＋ 新增類別</option></select>`;
 showModal(existing?'合約明細':'新增合約',`<form id="contractForm220" class="cases-form219" novalidate>
  <div class="cases-span219">${field('title','合約名稱',input('title','text',draft.title,'required maxlength="200"'))}</div>
  ${field('clientId','客戶',customer)}${field('categoryId','類別',category)}
  <div class="cases-span219" id="contractNewCategory220" hidden>${field('categoryName','新類別名稱',input('categoryName','text','','maxlength="32"'))}</div>
  <div class="cases-master219 cases-span219" id="contractClientPreview220" hidden></div>
  ${field('startDate','開始日期（選填）',input('startDate','date',draft.startDate))}
  ${field('endDate','到期日',input('endDate','date',draft.endDate,'required'))}
  <label class="cases-check219"><input id="contract-reminderEnabled220" type="checkbox" ${draft.reminderEnabled?'checked':''}>啟用到期提醒與待辦</label>
  ${field('leadMonths','提前幾個月',input('leadMonths','number',draft.leadMonths,'min="0" max="36" step="1" aria-describedby="contractPreviewDate220"')
   +'<span class="small muted" id="contractPreviewDate220"></span>')}
  <div class="cases-span219">${field('task','待辦事項',input('task','text',draft.task,'maxlength="240"'))}</div>
  <div class="cases-span219 field"><label for="contract-note220">備註</label><textarea class="textarea" id="contract-note220" maxlength="12000" rows="3">${esc(draft.note)}</textarea></div>
  <label class="cases-check219"><input id="contract-closed220" type="checkbox" ${draft.closed?'checked':''}>已結案</label>
  <p class="notice warn cases-span219" id="contractError220" role="alert" tabindex="-1" hidden></p>
 </form>`,[{text:'取消',value:false},{text:'儲存合約',value:true,cls:'primary'}],()=>{});
 const modal=root.querySelector('.modal'),form=$('#contractForm220'),error=$('#contractError220');
 modal.classList.add('cases-modal219','contract-modal220');
 const footer=modal.querySelector('.modal-foot'),[cancel,save]=footer.querySelectorAll('button');
 save.id='saveContract220';cancel.id='cancelContract220';
 const get=key=>$('#contract-'+key+'220');
 const collect=()=>({id:draft.id,title:get('title').value,clientId:get('clientId').value,categoryId:get('categoryId').value,
  startDate:get('startDate').value,endDate:get('endDate').value,leadMonths:get('leadMonths').value,
  reminderEnabled:get('reminderEnabled').checked,task:get('task').value,closed:get('closed').checked,note:get('note').value});
 const snapshot=()=>JSON.stringify([collect(),get('categoryName').value]);
 const initial=snapshot(),origin=document.activeElement;
 let busy=false;
 function updatePreview(){
  $('#contractNewCategory220').hidden=get('categoryId').value!=='__new';
  const customer=clientById(get('clientId').value),preview=$('#contractClientPreview220');
  preview.hidden=!customer;
  preview.innerHTML=customer?recordFacts220([['聯絡人',contactSummary(customer)],['地址',customer.address]]):'';
  let date='';
  try{date=contractEngine220.reminderDate(get('endDate').value,get('leadMonths').value);}catch{}
  $('#contractPreviewDate220').textContent=get('reminderEnabled').checked&&date?'提醒日 '+fmtDate(date):'0 為到期當日';
 }
 form.addEventListener('input',updatePreview);
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
  const controls=[...modal.querySelectorAll('input,textarea,select,button')];
  controls.forEach(node=>node.disabled=true);
  try{
   if(action==='save'&&fields.categoryId==='__new')contractEngine220.categoryFor(categoryName);
   await writeContract220({id:draft.id,draft:fields,baseline:existing,categoryName,action});
  }catch(failure){
   busy=false;controls.forEach(node=>node.disabled=false);
   const key=failure.field,target=key?get(key):null;
   const hint=key?form.querySelector(`[data-contract-field-error220="${key}"]`):null;
   if(target&&hint){
    hint.textContent=failure.message;hint.hidden=false;hint.id='contract-field-error-'+key+'220';
    target.setAttribute('aria-invalid','true');target.setAttribute('aria-errormessage',hint.id);target.focus();
   }else{error.textContent=failure.message||'合約未能儲存';error.hidden=false;error.focus();}
   return;
  }
  close();
  try{
   await loadAll();
   if(state.view==='contracts'&&!origin?.isConnected){
    const next=$$('#contractsList220 [data-open-contract220]').find(button=>button.dataset.openContract220===draft.id);
    (next||$('#newContract220'))?.focus({preventScroll:true});
   }
   toast(action==='delete'?'已刪除合約':'合約已儲存');
  }
  catch{toast('變更已儲存，請重新整理工作台');}
 }
 save.onclick=()=>commit('save');
 form.onsubmit=event=>{event.preventDefault();commit('save');};
 if(existing){
  const remove=vatElement214('button','btn danger','刪除合約');
  remove.type='button';remove.id='deleteContract220';
  remove.onclick=()=>{if(!busy&&window.confirm('確定刪除合約及其到期提醒？'))commit('delete');};
  footer.prepend(remove);
 }
 get('title')?.focus();
}

function contractReminderEvents220() {
 const today=localDate();
 return contracts220().filter(row=>contractEngine220.isDue(row,today))
  .sort((a,b)=>a.endDate.localeCompare(b.endDate)||a.id.localeCompare(b.id))
  .map(row=>{
   const customer=clientById(row.clientId);
   return {id:'contract-task:'+row.id,source:'contract',contractId:row.id,label:'合約到期待辦',client:customer?.name||'客戶已移除',
    code:customer?.code||'',detail:row.title+' · '+row.task,priority:'today',tone:'orange'};
  });
}
function contractCalendarItems220() {
 const rows=[];
 for(const contract of contracts220()){
  const base={source:'contract',contractId:contract.id,clientId:contract.clientId,contractStatus:contractEngine220.status(contract,localDate()),time:''};
  const reminderDate=contractReminderDate220(contract);
  const schedule={reminderEnabled:contract.reminderEnabled&&!contract.closed,reminderDate,reminderCompletedAt:contract.taskCompletedAt};
  const sameDay=contract.endDate===reminderDate;
  const suffix=contract.closed?'（已結案）':'';
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
  ['openContract220',id=>openContract220(id)],['contractCalendar220',id=>openContractCalendar220(id)],
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
