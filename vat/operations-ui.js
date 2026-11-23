/* VAT 2.23: accounting and notice workspace controls. */
function accountingStatusBadge223(pc,missing){
 if(pc.accountingCompletedAt)return statusBadge('已完成','green');
 return missing?statusBadge('待補文件','orange'):statusBadge('未完成','gray');
}
const operationsCompact223=matchMedia('(max-width: 799px)');
function updateOperationsDisclosures223(){
 for(const id of ['accountingPicker223','noticeLibrary223'])$('#'+id).open=!operationsCompact223.matches;
}
updateOperationsDisclosures223();
operationsCompact223.addEventListener('change',updateOperationsDisclosures223);

function renderAccountingClients223(){
 const pcs=pcForPeriod(),list=$('#accountingClientList'),query=String(state.accountingSearch||'').trim().toLowerCase();
 const status=$('#accountingStatus223').value;
 function matches(pc){
  if(query&&!`${pc.snapshot?.name||''} ${pc.snapshot?.code||''}`.toLowerCase().includes(query))return false;
  if(status==='open')return !pc.accountingCompletedAt;
  if(status==='done')return !!pc.accountingCompletedAt;
  if(status==='missing')return !!accPendingDocs(pc).length;
  if(status==='return')return !!(accPendingReturns(pc).length||accPriorPending(pc).items.length);
  return true;
 }
 const visible=pcs.filter(matches);
 $('#accountingClientCount223').textContent=`${visible.length} / ${pcs.length} 家`;
 list.innerHTML=visible.length?visible.map(accountingClientCard).join(''):`<div class="empty">${pcs.length?'沒有符合的客戶':'本期沒有客戶'}</div>`;
 list.querySelectorAll('[data-accounting-pc]').forEach(button=>button.onclick=()=>{
  const previous=list.querySelector('[aria-pressed="true"]');
  previous?.classList.remove('active');
  previous?.setAttribute('aria-pressed','false');
  button.classList.add('active');
  button.setAttribute('aria-pressed','true');
  if(state.accountingPCId!==button.dataset.accountingPc){
   state.accountingPCId=button.dataset.accountingPc;
   renderAccountingDetail();
  }
  if(operationsCompact223.matches){
   $('#accountingPicker223').open=false;
   $('#accountingDetail .accounting-detail-head')?.focus();
  }
 });
}
function setAccountingPanel223(panel){
 state.accountingFocus=panel;
 const root=$('#accountingDetail');
 root.querySelectorAll('[data-account-focus],#accountingFocusBackBtn').forEach(button=>{
  button.setAttribute('aria-pressed',String((button.dataset.accountFocus||null)===panel));
 });
 root.querySelectorAll('[data-acct-panel]').forEach(section=>{
  const active=section.dataset.acctPanel===panel;
  section.classList.toggle('active',active);
  section.hidden=!active;
 });
 $('#accountingOverview223').hidden=!!panel;
}
const bindAccountingBefore223=bindAccountingDetail;
bindAccountingDetail=function(pc){
 bindAccountingBefore223(pc);
 const root=$('#accountingDetail'),locked=accountingPeriodLocked218(pc);
 for(const kind of ['missing','return']){
  const panel=root.querySelector(`[data-acct-panel="${kind}"]`);
  const actions=panel.querySelector('.accounting-batch-actions');
  if(!actions)continue;
  const link=actions.querySelector('#goMissingNoticeBtn');
  if(link)panel.querySelector('.accounting-section-head .actions').append(link);
  const selected=vatElement214('span','accounting-selection223');
  selected.setAttribute('role','status');
  actions.prepend(selected);
  const all=[...panel.querySelectorAll('.acct-row-check:not([data-origin-pc])')];
  const buttons=actions.querySelectorAll('[data-acct-batch-action]');
  const update=()=>{
   const count=all.filter(input=>input.checked).length;
   selected.textContent=`已選 ${count} 筆`;
   actions.hidden=!count;
   buttons.forEach(button=>button.disabled=locked||!count);
  };
  all.forEach(input=>input.addEventListener('change',update));
  update();
 }
 root.querySelectorAll('[data-acct-quick229]').forEach(button=>button.onclick=async()=>{
  if(button.disabled)return;
  button.disabled=true;
  try{
   const result=await accountingBatchAction(pc,'missing','done',[button.dataset.acctQuick229]);
   if(result!==false)toast('已標記補齊');
  }finally{
   if(button.isConnected)button.disabled=locked;
  }
 });
 root.querySelectorAll('input.acct-row-check').forEach(input=>{
  input.setAttribute('aria-label',`選取 ${input.closest('tr').querySelector('.accounting-doc-name')?.textContent||'項目'}`);
 });
 const completion=$('#accountingCompletedAtInput');
 if(completion)completion.closest('.field').querySelector('label').htmlFor=completion.id;
};

function setNoticeCompose223(pane){
 $('#noticeCompose223').dataset.pane=pane;
 $$('[data-notice-compose]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.noticeCompose===pane)));
}
$$('[data-notice-compose]').forEach(button=>button.onclick=()=>setNoticeCompose223(button.dataset.noticeCompose));

const templateDrafts223=new Map();
function templateFields223(template){
 return {name:template.name||'',text:template.text||'',enabled:template.enabled!==false};
}
function readTemplateEditor223(){
 return {name:$('#templateName').value,text:$('#templateText').value,enabled:$('#templateEnabled').checked};
}
function sameTemplateDraft223(a,b){
 return !!a&&a.name===b.name&&a.text===b.text&&a.enabled===b.enabled;
}
function showTemplateDraft223(id){
 const dirty=templateDrafts223.has(id);
 $('#templateDraft223').hidden=!dirty;
 $('#discardTemplate223').hidden=!dirty;
}
function loadTemplateEditor223(template){
 const stored=templateFields223(template),draft=templateDrafts223.get(template.id);
 if(sameTemplateDraft223(draft,stored))templateDrafts223.delete(template.id);
 const values=templateDrafts223.get(template.id)||stored,editor=$('#templateEditorCard');
 if(editor.dataset.templateId!==template.id){
  setNoticeCompose223('write');
  $('#templateActions223').open=false;
  editor.querySelector('.template-variable-tools210').open=false;
  $('#variableSearch').value='';
 }
 editor.dataset.templateId=template.id;
 // Avoid moving the caret during updates that leave the same draft loaded.
 if($('#templateName').value!==values.name)$('#templateName').value=values.name;
 if($('#templateText').value!==values.text)$('#templateText').value=values.text;
 $('#templateEnabled').checked=values.enabled;
 showTemplateDraft223(template.id);
}
for(const [id,event] of [['templateName','input'],['templateText','input'],['templateEnabled','change']]){
 $('#'+id).addEventListener(event,()=>{
  const template=templateById($('#templateEditorCard').dataset.templateId);
  if(!template)return;
  const draft=readTemplateEditor223();
  if(sameTemplateDraft223(draft,templateFields223(template)))templateDrafts223.delete(template.id);
  else templateDrafts223.set(template.id,draft);
  showTemplateDraft223(template.id);
 });
}
$('#discardTemplate223').onclick=()=>{
 const template=selectedTemplate();
 if(!template)return;
 templateDrafts223.delete(template.id);
 loadTemplateEditor223(template);
 $('#templateActions223').open=false;
 $('#templateActions223 summary').focus();
 refreshTemplatePreview();
};

function placeCollectionControl223(){
 const exportMode=state.templateTab==='export';
 const box=$('#collectionFilter213');
 const dock=$(exportMode?'#noticeCollectionExport223':'#noticeContextBar .card-b');
 if(box.parentNode!==dock)dock.append(box);
 box.classList.toggle('hidden',!(exportMode?collectionExport213():collectionActive213()));
}
const renderNoticeContextBefore223=renderNoticeContext;
renderNoticeContext=function(){
 renderNoticeContextBefore223();
 placeCollectionControl223();
};
const renderTemplatesBefore223=renderTemplates;
renderTemplates=function(){
 const active=document.activeElement,templateId=active?.dataset.selectTemplate,typeId=active?.dataset.selectType;
 const focusedFilter=active?.id==='noticeGroup212';
 renderTemplatesBefore223();
 const mode=state.templateTab,category=$('#noticeFilters212');
 $(mode==='reminders'?'#noticeCategoryReminder223':'#noticeCategoryManage223').append(category);
 const type=notificationTypeById(state.selectedNotificationTypeId),template=selectedTemplate();
 $('#noticeLibrarySelection223').textContent=[type?.name,template?.name].filter(Boolean).join('／');
 $$('[data-template-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.templateTab===mode)));
 if(focusedFilter)$('#noticeGroup212').focus({preventScroll:true});
 if(templateId||typeId){
  const pane=mode==='reminders'?'#templateReminderPane':'#templateManagePane';
  const replacement=$(pane).querySelector(templateId?`[data-select-template="${CSS.escape(templateId)}"]`:`[data-select-type="${CSS.escape(typeId)}"]`);
  replacement?.focus({preventScroll:true});
 }
};
$('#templateCards').addEventListener('click',event=>{
 if(event.target.closest('[data-select-template]')&&operationsCompact223.matches){
  $('#noticeLibrary223').open=false;
  $('#templateName').focus();
 }
});

$('#variableChips').addEventListener('click',event=>{
 if(event.target.closest('[data-var]'))setNoticeCompose223('write');
},{capture:true});

function renderExportChoices223(){
 const list=$('#exportClients223'),options=[...$('#txtClients').options];
 const focused=list.contains(document.activeElement)?document.activeElement.value:null;
 const scroll=list.scrollTop;
 list.replaceChildren();
 if(!options.length){list.append(vatElement214('div','empty','沒有符合的客戶'));return}
 const fragment=document.createDocumentFragment();
 for(const option of options){
  const label=vatElement214('label','check-row'),checkbox=document.createElement('input');
  checkbox.type='checkbox';
  checkbox.value=option.value;
  checkbox.checked=option.selected;
  checkbox.onchange=()=>{
   option.selected=checkbox.checked;
   updateExportSummary();
  };
  label.append(checkbox,vatElement214('span','',option.textContent));
  fragment.append(label);
 }
 list.append(fragment);
 list.scrollTop=scroll;
 if(focused)list.querySelector(`input[value="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
}
const renderTxtClientOptionsBefore223=renderTxtClientOptions;
renderTxtClientOptions=function(){
 renderTxtClientOptionsBefore223();
 placeCollectionControl223();
 renderExportChoices223();
};
const updateExportSummaryBefore223=updateExportSummary;
updateExportSummary=function(){
 updateExportSummaryBefore223();
 const select=$('#txtClients');
 const selected=new Set([...select.selectedOptions].map(option=>option.value));
 $('#exportClients223').querySelectorAll('input').forEach(input=>input.checked=selected.has(input.value));
 $('#txtSelectAllBtn').disabled=!select.options.length;
 const count=$('#exportFilterCount215');
 if(count)count.textContent=`符合 ${select.options.length} 家 · 已選 ${selected.size} 家`;
};
