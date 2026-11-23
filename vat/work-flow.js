/* Period summary, customer shortcuts and date inputs for the four-step workspace. */
const workQuickOptions229=[
 ['carry','跨下期發票','carryClients'],['prior','上期稅額參考','priorTaxClients'],
 ['debt','歷史尚欠','historyDebtClients'],['tax','尚有應繳未繳','taxOpenClients']
];
function workQuickMatch229(pc,key){
 if(pc.notApplicable)return false;
 if(key==='carry')return invoiceCarryProgress218(pc).pending;
 if(key==='prior')return !!priorTaxReference(pc);
 if(key==='debt')return linkedReceivableProgress218(pc).carryRemainingTotal>0;
 return payableOpenCount(pc)>0;
}
function workCandidate229(rows){
 return rows[0]?.id||(!state.workQuick229?pcForPeriod()[0]?.id:null)||null;
}
function renderWorkPeriodSummary229(period){
 const root=$('#workCommonSettings');
 root.hidden=!period;
 if(!period){root.replaceChildren();return;}
 const notes=sharedMessages214(period).filter(note=>note.trim());
 const lead=effectiveDispatchLeadDays(period);
 const dates=[
  ['最晚匯款',fmtDate(period.latestRemitDate)],
  ['最晚寄出',period.latestDispatchDate?fmtDate(period.latestDispatchDate):lead==null?'—':'預約日前 '+lead+' 天'],
  ['法定繳款',fmtDate(period.dueDate||statutoryDueDate(period.year,period.slot))]
 ];
 root.innerHTML=dates.map(([label,value])=>`<span class="work-summary-date229">${label} <strong>${esc(value)}</strong></span>`).join('')+
  `<span class="work-summary-note229" title="${esc(notes.join('\n'))}">共用備註 <strong>${esc(notes.join(' ／ ')||'—')}</strong></span>
   <button type="button" class="btn small" id="editCurrentPeriodSettings">期別設定</button>`;
 $('#editCurrentPeriodSettings').onclick=()=>openPeriodSettings(period);
}
function renderWorkQuickFilters229(){
 const root=$('#workQuickFilters229');
 if(!root)return;
 const stats=workPeriodStatsV24(currentPeriod());
 const focused=root.contains(document.activeElement)?document.activeElement.dataset.workQuick229:'';
 root.innerHTML=workQuickOptions229.map(([key,label,total])=>
  `<button type="button" class="btn" data-work-quick229="${key}" aria-pressed="${state.workQuick229===key}">${label} <strong>${stats[total]}</strong></button>`).join('');
 for(const button of root.children){
  const key=button.dataset.workQuick229;
  button.onclick=()=>{
   const previous=state.workQuick229;
   const target=state.workQuick229=previous===key?'':key;
   const rows=filteredWorkPCs();
   if(!rows.some(row=>row.id===state.selectedPCId)&&workDirty210()){
    state.workQuick229=previous;
    if(!allowDiscard210())return;
    state.workQuick229=target;
    renderWorkDetail();
   }
   renderWork();
  };
  if(key===focused)button.focus({preventScroll:true});
 }
}
function mountWorkFlow229(){
 const search=$('#workSearch'),quick=vatElement214('div','work-quick229');
 quick.id='workQuickFilters229';
 quick.setAttribute('role','group');
 quick.setAttribute('aria-label','客戶快速篩選');
 search.closest('.work-list-toolbar').after(quick);
 const tabs=$('#view-work .work-tabs');
 const bulk=vatElement214('details','work-batch229');
 bulk.id='bulkWork215';
 bulk.innerHTML='<summary class="btn">批次作業 <span aria-hidden="true">▾</span></summary><div class="work-batch-items229">'+
  [['receipt','收發票'],['date','建立日期'],['tax','稅額登記'],['carry','跨期事項'],['paid','繳納'],['payment','客戶付款'],['notes','補充事項']]
   .map(([key,label])=>`<button type="button" class="btn ghost" data-bulk-work215="${key}">${label}</button>`).join('')+'</div>';
 tabs.append(bulk);
 document.addEventListener('click',event=>{if(bulk.open&&!bulk.contains(event.target))bulk.open=false;});
 bulk.addEventListener('keydown',event=>{if(event.key==='Escape'){bulk.open=false;bulk.querySelector('summary').focus();}});
}

function workDateISO229(value){
 if(!value.trim())return '';
 const match=value.normalize('NFKC').trim().match(/^(-?\d{1,3})[/-](\d{1,2})[/-](\d{1,2})$/);
 if(!match)return null;
 const [,year,month,day]=match;
 const iso=String(Number(year)+1911).padStart(4,'0')+'-'+month.padStart(2,'0')+'-'+day.padStart(2,'0');
 return validDate210(iso)?iso:null;
}
const workDateSources229='#view-work input[type=date],#modalRoot :is(#epRemit,#epDispatchDate,#epDue,#bulkWorkForm215 input[type=date],#bulkModuleForm216 input[type=date])';
function syncWorkDates229(){
 const roc=currentDateMode()==='roc';
 for(const source of $$(workDateSources229)){
  let display=source.nextElementSibling;
  if(!display?.matches('.work-roc-input229')){
   if(!roc)continue;
   display=vatElement214('input','input work-roc-input229');
   display.type='text';
   display.placeholder='例 115/11/23';
   display.autocomplete='off';
   const label=source.closest('.field')?.querySelector('label,span');
   display.setAttribute('aria-label',(source.getAttribute('aria-label')||label?.textContent.trim()||'日期')+'（民國年/月/日）');
   source.after(display);
   display.oninput=()=>{
    const iso=workDateISO229(display.value);
    display.setCustomValidity(iso===null?'請輸入有效的民國日期，例如 115/11/23':'');
    if(iso===null){display.setAttribute('aria-invalid','true');return;}
    display.removeAttribute('aria-invalid');
    source.value=iso;
    display.dataset.iso=source.value;
    source.dispatchEvent(new Event('input',{bubbles:true}));
   };
   display.onchange=()=>{
    if(!display.validity.valid){display.reportValidity();return;}
    source.dispatchEvent(new Event('change',{bubbles:true}));
    if(source.isConnected)display.value=source.value?fmtDate(source.value):'';
   };
  }
  source.classList.toggle('work-native-hidden229',roc);
  display.hidden=!roc;
  display.disabled=source.disabled;
  if(display.dataset.iso!==source.value||!roc){
   display.value=source.value?fmtDate(source.value):'';
   display.dataset.iso=source.value;
   display.setCustomValidity('');
   display.removeAttribute('aria-invalid');
  }
 }
}
function invalidWorkDate229(root=$('#view-work')){
 return root?.querySelector('.work-roc-input229:not([hidden])[aria-invalid="true"]')||null;
}
const workWireBefore229=wire;
wire=function(){
 workWireBefore229();
 mountWorkFlow229();
 const observer=new MutationObserver(records=>{
  if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&!node.matches('.work-roc-input229'))))syncWorkDates229();
 });
 for(const root of [$('#view-work'),$('#modalRoot')])observer.observe(root,{childList:true,subtree:true});
 document.addEventListener('click',event=>{
  if(event.target.closest('#bulkApplyDate215,#bulkModuleApply216,#bulkModuleSelect216'))syncWorkDates229();
 });
 document.addEventListener('change',event=>{
  if(event.target.closest('#view-work,#modalRoot'))syncWorkDates229();
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest('#saveWorkBtn,#dateModeBtn,#modalRoot .modal-foot button:last-child');
  if(!button)return;
  const invalid=invalidWorkDate229(button.closest('#modalRoot')||$('#view-work'));
  if(!invalid)return;
  event.preventDefault();event.stopImmediatePropagation();
  const panel=invalid.closest('[data-focus-panel]');
  if(panel)applyWorkFocusV24(panel.dataset.focusPanel,false);
  invalid.focus();invalid.reportValidity();
 },true);
 syncWorkDates229();
};
const workRenderBefore229=renderWork;
renderWork=function(){workRenderBefore229();syncWorkDates229();};
