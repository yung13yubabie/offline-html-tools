/* Customer cases: one source record, live customer lookup and derived local calendar reminders. */
const caseRuntime219={query:'',clientId:'',status:'active',page:1,size:12,expanded:new Set(),folders:new Map(),limits:new Map()},caseAckBusy219=new Set();let caseMinuteTimer219=null;
const CASE_STATUS219={pending:'待處理',inProgress:'進行中',done:'已完成',cancelled:'已取消'};
function caseEngine219(){return createCasesEngine219();}
function caseCustomer219(record){return clientById(record.clientId)||null;}
function caseStatusBadge219(status){return statusBadge(CASE_STATUS219[status]||'需核對',{pending:'yellow',inProgress:'blue',done:'green',cancelled:'gray'}[status]||'red');}
function caseTransaction219({action='save',draft=null,baseline=null,id=draft?.id}){return new Promise((resolve,reject)=>{
 let tr,current,clients,loaded=false,result,failure;try{tr=db.transaction(['cases','clients'],'readwrite')}catch(error){reject(error);return}const store=tr.objectStore('cases');
 const fail=error=>{failure=error;try{tr.abort()}catch{}};
 const build=()=>{if(!loaded||!clients||failure)return;try{const engine=caseEngine219(),at=nowISO();if(action==='delete'){engine.assertBaseline(current,baseline);store.delete(id);result={id,deleted:true};return}if(action==='ack'){result=engine.acknowledge({current,baseline,clients,at});store.put(result);return}if(!baseline&&current)throw new Error('案件編號已存在，請重新新增');result=engine.planSave({current,baseline,draft,clients,at,today:localDate()});store.put(result)}catch(error){fail(error)}};
 const rr=store.get(id),cr=tr.objectStore('clients').getAll();rr.onsuccess=()=>{current=rr.result||null;loaded=true;build()};cr.onsuccess=()=>{clients=cr.result;build()};tr.oncomplete=()=>resolve(result);tr.onerror=()=>{};tr.onabort=()=>reject(failure||tr.error||new Error('案件未完成儲存，請保留內容重試'));
 });}
function commitCase219(draft,baseline=null){return caseTransaction219({draft:clone(draft),baseline:baseline?clone(baseline):null});}
function deleteCase219(id,baseline){return caseTransaction219({action:'delete',id,baseline:clone(baseline)});}
function ackCaseReminder219(id,baseline){return caseTransaction219({action:'ack',id,baseline:clone(baseline)});}
function caseLocalDate219(value){const date=new Date(value);return `${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function calendarCaseItems219(){
 const engine=caseEngine219(),events=[];for(const record of state.cases||[]){const customer=caseCustomer219(record),live={source:'case',caseId:record.id,clientId:record.clientId,clientName:customer?.name||'客戶已移除',clientCode:customer?.code||'',caseStatus:record.status},date=record.dueDate||record.startDate,closed=!engine.active(record.status);
  const hasReminder=!closed&&record.reminderEnabled===true;
  const schedule={reminderEnabled:hasReminder,reminderDate:record.reminderDate||'',reminderTime:record.reminderTime||'',reminderCompletedAt:record.reminderCompletedAt||''};
  const sameDayReminder=hasReminder&&schedule.reminderDate===date;
  if(engine.date(date))events.push({...live,...schedule,id:'case-plan:'+record.id,eventKind:'planned',date,
   time:record.dueDate?record.dueTime||'':'',reminderEnabled:sameDayReminder,
   content:`案件${record.dueDate?'截止':'開始'}｜${record.title}${closed?'（'+(CASE_STATUS219[record.status]||'需核對')+'）':''}`});
  if(hasReminder&&!sameDayReminder&&engine.date(schedule.reminderDate)){
   events.push({...live,...schedule,id:'case-reminder-day:'+record.id,eventKind:'reminder',date:schedule.reminderDate,
    time:schedule.reminderTime,content:'案件提醒｜'+record.title});
  }
  if(record.status==='done'&&engine.iso(record.completedAt)){const instant=new Date(record.completedAt);events.push({...live,id:'case-done:'+record.id,eventKind:'completed',date:caseLocalDate219(record.completedAt),time:instant.toTimeString().slice(0,5),content:'案件完成｜'+record.title,reminderEnabled:false});}
 }return events;
}
function caseReminderEvents219(){const engine=caseEngine219(),now=new Date();return (state.cases||[]).filter(record=>engine.reminderDue(record,now)).map(record=>{const customer=caseCustomer219(record);return {id:'case-reminder:'+record.id,source:'case',caseId:record.id,type:'caseReminder',label:'案件提醒',client:customer?.name||'客戶已移除',code:customer?.code||'',detail:record.title,priority:'today',tone:'blue'};});}
function mountCases219(){let view=$('#view-cases');if(!view){view=document.createElement('section');view.id='view-cases';view.className='view';$('.main')?.append(view)}if(!view||$('#casesCards219'))return;
 view.setAttribute('aria-label','案件');view.dataset.reviewId='vat-workbench-view-cases';view.dataset.reviewName='案件';
 view.innerHTML='<div class="page-head"><div><h1 class="page-title">案件</h1></div><div class="actions"><button class="btn primary" id="newCase219">新增案件</button></div></div><div class="cases-stats219" id="casesStats219" role="group" aria-label="依狀態篩選案件"></div><div class="cases-filters219"><div class="field"><label for="casesSearch219">搜尋案件</label><input class="input" id="casesSearch219" type="search" placeholder="案件、客戶、聯絡人或備註"></div><div class="field"><label for="casesClient219">客戶</label><select class="select" id="casesClient219"></select></div><div class="field"><label for="casesStatus219">狀態</label><select class="select" id="casesStatus219"><option value="active">未結案</option><option value="all">全部狀態</option><option value="inProgress">進行中</option><option value="pending">待處理</option><option value="done">已完成</option><option value="cancelled">已取消</option></select></div><button class="btn" id="clearCases219">清除條件</button></div><div class="cases-result219" id="casesCount219" aria-live="polite"></div><div id="casesCards219"></div><div id="casesPager219"></div>';
 $('#newCase219').onclick=()=>openCase219();$('#casesSearch219').oninput=e=>{caseRuntime219.query=e.target.value;caseRuntime219.page=1;renderCases219()};$('#casesClient219').onchange=e=>{caseRuntime219.clientId=e.target.value;caseRuntime219.page=1;renderCases219()};$('#casesStatus219').onchange=e=>{caseRuntime219.status=e.target.value;caseRuntime219.page=1;renderCases219()};$('#clearCases219').onclick=()=>{Object.assign(caseRuntime219,{query:'',clientId:'',status:'active',page:1});renderCases219()};
}
function renderCases219(){mountCases219();if(!$('#casesCards219'))return;const runtime=caseRuntime219,engine=caseEngine219(),all=Array.isArray(state.cases)?state.cases:[],now=new Date(),today=localDate(),clock=now.toTimeString().slice(0,5),q=runtime.query.trim().toLocaleLowerCase();
 const clientFilter=$('#casesClient219');
 if(runtime.clientId&&!clientById(runtime.clientId))runtime.clientId='';
 clientFilter.innerHTML='<option value="">全部客戶</option>'+recordClientOptions220(runtime.clientId);
 $('#casesStatus219').value=runtime.status;
 if($('#casesSearch219').value!==runtime.query)$('#casesSearch219').value=runtime.query;
 const counts=Object.fromEntries(Object.keys(CASE_STATUS219).map(key=>[key,0]));
 const filtered=all.filter(record=>{
  if(runtime.clientId&&record.clientId!==runtime.clientId)return false;
  const customer=caseCustomer219(record);
  const progress=(record.progress||[]).flatMap(entry=>[entry.stage,entry.note]);
  const searchable=[record.title,record.note,customer?.name,customer?.code,customer?contactSummary(customer):'',...progress].join(' ').toLocaleLowerCase();
  if(q&&!searchable.includes(q))return false;
  if(Object.hasOwn(counts,record.status))counts[record.status]++;
  return runtime.status==='all'||(runtime.status==='active'?engine.active(record.status):record.status===runtime.status);
 }).sort((a,b)=>Number(!engine.active(a.status))-Number(!engine.active(b.status))||
  (a.dueDate||'9999').localeCompare(b.dueDate||'9999')||String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))||String(a.id).localeCompare(String(b.id)));
 renderRecordStatusFilters227($('#casesStats219'),Object.entries(CASE_STATUS219).map(([key,label])=>[key,label,counts[key]]),runtime,'active',renderCases219);
 const host=$('#casesCards219');
 const makeRow=record=>{
  const overdue=engine.overdue(record,today,clock);
  const progress=engine.progressInOrder(record),latest=progress.at(-1);
  const when=record.dueDate?fmtDate(record.dueDate)+(record.dueTime?' '+record.dueTime:''):fmtDate(record.startDate);
  const reminder=record.reminderEnabled?`${fmtDate(record.reminderDate)} ${record.reminderTime||''}`.trim():'';
  const reminderState=record.reminderCompletedAt?`已確認 ${fmtDateTime(record.reminderCompletedAt)}`:record.reminderEnabled&&!engine.active(record.status)?'已停止':'';
  return {id:record.id,keyAttribute:'data-case-id219',
   cells:[`<h2>${esc(record.title)}</h2>${latest?`<small class="case-current-progress232">${esc(latest.stage)}</small>`:''}`,caseStatusBadge219(record.status)+(overdue?' <span class="badge b-orange">已逾期</span>':''),
    `<strong>${esc(when)}</strong><small>${record.dueDate?'截止':'開始'}</small>`,
    `<button class="btn" type="button" data-open-case219="${esc(record.id)}" aria-label="編輯案件：${esc(record.title)}">編輯</button>`],
   schedule:[['開始',fmtDate(record.startDate),record.startDate],['提醒',reminder,record.reminderDate,record.reminderTime],
    ['截止',record.dueDate?when:'',record.dueDate,record.dueTime||'24:00']],
   facts:[['提醒狀態',reminderState]],
   extra:progress.length?`<div class="case-progress-log232"><h3>進度紀錄</h3><ol>${progress.map(entry=>
    `<li><time datetime="${esc(entry.date)}">${esc(fmtDate(entry.date))}</time><div><strong>${esc(entry.stage)}</strong>${entry.note?`<p>${esc(entry.note)}</p>`:''}</div></li>`).join('')}</ol></div>`:'',
   detailActions:`<div class="record-detail-actions220"><button class="btn record-secondary-action227" type="button" data-case-calendar219="${esc(record.id)}">查看日曆</button></div>`,
   note:record.note,
   meta:[['建立',fmtDateTime(record.createdAt)],['更新',fmtDateTime(record.updatedAt)],...(record.completedAt?[['完成',fmtDateTime(record.completedAt)]]:[])]
  };
 };
 const count=clientFolders222({host,pager:$('#casesPager219'),runtime,matched:filtered,all,kind:'案件',
  columns:['案件','狀態','日期','操作'],makeRow,render:renderCases219,bind:bindCaseButtons219});
 $('#casesCount219').textContent=`${count} 位客戶 · ${filtered.length} 件案件`;
}
function openCase219(id=null){
 const existing=id?(state.cases||[]).find(record=>record.id===id):null;if(id&&!existing){toast('案件已被刪除，請重新整理');return}const baseline=existing?clone(existing):null,draft=existing?clone(existing):{id:uid('case'),clientId:'',title:'',status:'inProgress',startDate:localDate(),dueDate:'',dueTime:'',reminderEnabled:false,reminderDate:'',reminderTime:'09:00',note:''};
 const origin=document.activeElement;
 const orphan=!!draft.clientId&&!clientById(draft.clientId);
 showModal(existing?'編輯案件':'新增案件',`<form id="caseForm219" class="cases-form219 record-form222">
  <div class="field cases-span219"><label for="caseTitle219">案件名稱</label><input id="caseTitle219" class="input" maxlength="200" value="${esc(draft.title)}" required></div>
  <div class="field"><label for="caseClient219">客戶</label><select id="caseClient219" class="select" required><option value="">選擇客戶</option>
   ${orphan?`<option value="${esc(draft.clientId)}">客戶已移除</option>`:''}${recordClientOptions220(draft.clientId)}</select></div>
  <div class="field"><label for="caseStatus219">狀態</label><select id="caseStatus219" class="select">
   ${Object.entries(CASE_STATUS219).map(([key,label])=>`<option value="${key}" ${key===draft.status?'selected':''}>${label}</option>`).join('')}</select></div>
  <div class="field"><label for="caseStart219">開始日期</label><input id="caseStart219" class="input" type="date" value="${esc(draft.startDate)}" required></div>
  <div class="record-date-pair222"><div class="field"><label for="caseDue219">截止日期</label><input id="caseDue219" class="input" type="date" value="${esc(draft.dueDate)}"></div>
  <div class="field" id="caseDueTimeField222" ${draft.dueDate?'':'hidden'}><label for="caseDueTime219">截止時間</label>
   <input id="caseDueTime219" class="input" type="time" value="${esc(draft.dueTime)}"></div></div>
  <div class="record-reminder-settings227 case-reminder-settings227 cases-span219">
   <label class="cases-check219 record-toggle222"><input id="caseReminder219" type="checkbox" aria-controls="caseReminderFields219" ${draft.reminderEnabled?'checked':''}>提醒</label>
   <div class="cases-reminder-fields219" id="caseReminderFields219" ${draft.reminderEnabled?'':'hidden'}>
    <div class="field"><label for="caseReminderDate219">提醒日期</label><input id="caseReminderDate219" class="input" type="date" value="${esc(draft.reminderDate)}"></div>
    <div class="field"><label for="caseReminderTime219">提醒時間</label><input id="caseReminderTime219" class="input" type="time" value="${esc(draft.reminderTime)}"></div>
   </div>
  </div>
  <div class="field cases-span219"><label for="caseNote219">備註</label><textarea id="caseNote219" class="textarea" rows="2" maxlength="12000">${esc(draft.note)}</textarea></div>
  <details class="case-progress-editor232 cases-span219" ${draft.progress?.length?'open':''}>
   <summary>進度紀錄 <span id="caseProgressCount232">${draft.progress?.length||0} 筆</span></summary>
   <div id="caseProgressRows232"></div>
   <button type="button" class="btn" id="caseProgressAdd232">＋ 新增進度</button>
  </details>
  <p class="notice warn cases-span219" id="caseError219" role="alert" tabindex="-1" hidden></p>
 </form>`,[{text:'取消',value:false},{text:'儲存案件',value:true,cls:'primary'}],()=>{});
 const root=$('#modalRoot'),modal=root.querySelector('.modal'),form=$('#caseForm219');
 modal.classList.add('cases-modal219','record-modal222');
 const footer=modal.querySelector('.modal-foot'),cancel=footer.querySelector('button:first-child'),save=footer.querySelector('button:last-child');
 cancel.id='caseCancel219';save.id='caseSave219';
 if(orphan)$('#caseClient219').value=draft.clientId;
 const progressRows=$('#caseProgressRows232'),addProgress=$('#caseProgressAdd232'),progressLimit=caseEngine219().maxProgress;
 function countProgress(){
  $('#caseProgressCount232').textContent=progressRows.childElementCount+' 筆';
  addProgress.disabled=progressRows.childElementCount>=progressLimit;
 }
 function addProgressRow({date=localDate(),stage='',note=''}={}){
  progressRows.insertAdjacentHTML('beforeend',`<div class="case-progress-row232">
   <label class="field">日期<input type="date" class="input" data-progress-date value="${esc(date)}"></label>
   <label class="field">進度階段<input class="input" data-progress-stage maxlength="120" value="${esc(stage)}"></label>
   <label class="field">說明（選填）<textarea class="textarea" rows="1" data-progress-note maxlength="1000">${esc(note)}</textarea></label>
   <button class="btn ghost danger" type="button" data-remove-progress>移除</button>
  </div>`);
  countProgress();
  return progressRows.lastElementChild.querySelector('[data-progress-stage]');
 }
 (draft.progress||[]).forEach(addProgressRow);
 addProgress.onclick=()=>{if(progressRows.childElementCount<progressLimit)addProgressRow().focus();};
 progressRows.onclick=event=>{
  const remove=event.target.closest('[data-remove-progress]');
  if(!remove)return;
  const row=remove.closest('.case-progress-row232'),adjacent=row.nextElementSibling||row.previousElementSibling;
  row.remove();
  countProgress();
  (adjacent?.querySelector('[data-remove-progress]')||addProgress).focus();
 };
 const collectProgress=()=>[...progressRows.children].map(row=>({date:row.querySelector('[data-progress-date]').value,
  stage:row.querySelector('[data-progress-stage]').value,note:row.querySelector('[data-progress-note]').value}));
 const collect=()=>({...draft,title:$('#caseTitle219').value,clientId:$('#caseClient219').value,status:$('#caseStatus219').value,startDate:$('#caseStart219').value,dueDate:$('#caseDue219').value,dueTime:$('#caseDueTime219').value,reminderEnabled:$('#caseReminder219').checked,reminderDate:$('#caseReminderDate219').value,reminderTime:$('#caseReminderTime219').value,note:$('#caseNote219').value,progress:collectProgress()}),snapshot=()=>JSON.stringify(collect());let initial=snapshot(),busy=false;
 const close=()=>{
  if(busy)return;
  if(snapshot()!==initial&&!window.confirm('案件尚未儲存，確定捨棄這次變更？'))return;
  root.classList.remove('show');root.innerHTML='';
  if(origin?.isConnected)origin.focus();
 };
 cancel.onclick=close;
 modal.querySelector('[data-close]').onclick=close;
 root.onclick=event=>{if(event.target===root)close()};
 modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close()}});
 $('#caseDue219').onchange=()=>{const filled=!!$('#caseDue219').value;$('#caseDueTimeField222').hidden=!filled;if(!filled)$('#caseDueTime219').value=''};
 const reminderToggle=$('#caseReminder219'),reminderFields=$('#caseReminderFields219');
 reminderToggle.onchange=()=>{reminderFields.hidden=!reminderToggle.checked;};
 const act=async fn=>{if(busy)return;busy=true;const controls=[...modal.querySelectorAll('input,select,textarea,button')].map(node=>[node,node.disabled]),error=$('#caseError219');controls.forEach(([node])=>node.disabled=true);error.hidden=true;try{await fn();await loadAll();initial=snapshot();if(modal.isConnected){root.classList.remove('show');root.innerHTML=''}renderCases219()}catch(failure){if(error.isConnected){error.hidden=false;error.textContent=failure.message||'案件未能儲存，請保留資料重試';error.focus?.()}else toast(failure.message||'案件未能儲存')}finally{busy=false;for(const[node,disabled]of controls)if(node.isConnected)node.disabled=disabled;}};
 const submit=event=>{event?.preventDefault();const next=collect();act(async()=>{await commitCase219(next,baseline);toast('案件已儲存')})};save.onclick=submit;form.onsubmit=submit;
 if(existing){const remove=vatElement214('button','btn danger','刪除案件');remove.id='caseDelete219';remove.type='button';remove.onclick=()=>{if(busy||!window.confirm('確定刪除這個案件？相關日曆項目會一併移除。'))return;act(async()=>{await deleteCase219(existing.id,baseline);toast('案件已刪除')})};footer.prepend(remove);}
 $('#caseTitle219')?.focus();
}
async function confirmCaseReminder219(id){if(caseAckBusy219.has(id))return;const baseline=(state.cases||[]).find(record=>record.id===id);if(!baseline){toast('案件已被刪除');return}caseAckBusy219.add(id);const buttons=$$('[data-case-reminder219]').filter(button=>button.dataset.caseReminder219===id);buttons.forEach(button=>button.disabled=true);try{await ackCaseReminder219(id,baseline);await loadAll();if($('#calendarDrawer')?.classList.contains('show'))openCalendarDrawer(state.calendarSelectedDate);toast('案件提醒已確認')}catch(error){toast(error.message||'提醒未能儲存，請重試')}finally{caseAckBusy219.delete(id);buttons.forEach(button=>{if(button.isConnected)button.disabled=false})}}
function openCaseCalendar219(id){const record=(state.cases||[]).find(item=>item.id===id),event=calendarCaseItems219().find(item=>item.caseId===id&&item.eventKind==='planned');if(!record||!event){toast('案件排程已不存在');return}state.calendarFilters={q:'',clientId:record.clientId,from:'',to:''};state.calendarMonth=event.date.slice(0,7);state.calendarSelectedDate=event.date;switchView('calendar');renderCalendar();openCalendarDrawer(event.date);}
function bindCaseButtons219(root=document){root.querySelectorAll('[data-open-case219]').forEach(button=>button.onclick=event=>{event.stopPropagation();openCase219(button.dataset.openCase219)});root.querySelectorAll('[data-case-calendar219]').forEach(button=>button.onclick=()=>openCaseCalendar219(button.dataset.caseCalendar219));root.querySelectorAll('[data-case-reminder219]').forEach(button=>button.onclick=event=>{event.stopPropagation();confirmCaseReminder219(button.dataset.caseReminder219)});}
const caseCalendarBefore219=calendarAllItems;
calendarAllItems=function(){return [...caseCalendarBefore219(),...calendarCaseItems219()];};
const caseCalendarClientBefore219=calendarItemClient;
calendarItemClient=function(event){return event?.source==='case'?clientById(event.clientId)||{name:'客戶已移除',code:''}:caseCalendarClientBefore219(event);};
const caseCalendarCardBefore219=noteCardHtml;
noteCardHtml=function(event){if(event?.source!=='case')return caseCalendarCardBefore219(event);const customer=calendarItemClient(event);return `<div class="note-card case-calendar219 ${calendarReminderClass(event)}" data-case-calendar-id219="${esc(event.id)}"><div class="note-time">${esc(event.time||'未指定時間')}</div><div><div class="note-client">${esc(customer.name||'未命名客戶')} <span class="work-linked-tag">案件</span></div><div class="note-content">${esc(event.content)}</div>${caseStatusBadge219(event.caseStatus)}${event.reminderEnabled?`<div class="small muted">${esc(calendarReminderLabel(event))}</div>`:''}</div><div class="note-actions"><button class="btn small" data-open-case219="${esc(event.caseId)}">查看案件</button>${event.reminderEnabled&&!event.reminderCompletedAt?`<button class="btn small" data-case-reminder219="${esc(event.caseId)}">確認提醒</button>`:''}</div></div>`;};
const caseCalendarBindBefore219=bindCalendarNoteActions;
bindCalendarNoteActions=function(){caseCalendarBindBefore219();bindCaseButtons219($('#view-calendar')||document);bindCaseButtons219($('#calendarDrawer')||document);};
const caseReminderBefore219=calendarReminderEvents;
calendarReminderEvents=function(){return [...caseReminderBefore219(),...caseReminderEvents219()];};
function renderCaseReminderStrip219(){
 const strip=$('#caseReminderStrip219');
 if(!strip)return;
 const due=caseReminderEvents219();
 strip.innerHTML=`<header class="today-reminder-heading226">
  <h2 id="todayCasesTitle226">案件提醒 <span class="badge b-blue">${due.length}</span></h2>
  ${due.length>3?'<button type="button" class="today-link226" id="showAllCaseReminders219">查看全部</button>':''}
 </header>
 ${due.length?`<ul class="today-reminder-list226">${due.slice(0,3).map(event=>`<li>
  <button type="button" class="today-case-row226" data-open-case219="${esc(event.caseId)}">
   <span class="today-reminder-client226">${esc(event.client)}</span><span class="today-case-topic226">${esc(event.detail)}</span>
  </button></li>`).join('')}</ul>`:'<p class="today-reminder-empty226">目前沒有案件提醒</p>'}`;
 $('#showAllCaseReminders219')?.addEventListener('click',()=>$('#todaySystemTab210')?.click());
}
const caseTodayBefore219=renderToday;
renderToday=function(){
 const result=caseTodayBefore219();
 renderCaseReminderStrip219();
 bindCaseButtons219($('#view-today')||document);
 return result;
};
const caseRenderAllBefore219=renderAll;
renderAll=function(){const result=caseRenderAllBefore219();renderCases219();return result;};
const caseSwitchBefore219=switchView;
switchView=function(view){const result=caseSwitchBefore219(view);if(state.view==='cases')renderCases219();return result;};
const caseWireBefore219=wire;
wire=function(){caseWireBefore219();mountCases219();renderCases219();if(caseMinuteTimer219==null){caseMinuteTimer219=setInterval(refreshCaseReminders219,60000);document.addEventListener('visibilitychange',refreshCaseReminders219);}};

function refreshCaseReminders219(){if(document.hidden||!['today','cases','contracts'].includes(state.view)||caseAckBusy219.size||$('#modalRoot.show')||document.querySelector('dialog[open]'))return;const focus=document.activeElement;if(focus&&(focus.matches('input,select,textarea,[contenteditable=true]')||focus.closest('[contenteditable=true],.record-list220,.record-pager220,.contract-stats220,#casesStats219')))return;if(state.view==='today')renderToday();else if(state.view==='cases')renderCases219();else renderContracts220();}
