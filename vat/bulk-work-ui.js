/* VAT_BULK_WORK215_START — atomic per-period edits and notification filters. */
(()=>{
 'use strict';
 const policy=createVATBulkPolicy215(),groups=createGroupPaymentEngine214();
 const dateFields={appointmentDate:'預約收發票日',plannedTaxPayDate:'預計繳稅日'};
 const filters={dateField:'appointmentDate',date:'all',tax:'all'};
 function taxText(pc){if(!policy.hasTax(pc))return '未登記稅額';const value=policy.amount(pc.taxAmount);return value<0?'留底 '+money(-value)+' 元':money(value)+' 元';}
 function completedRecord(pc,p,type,result,at){const event={稅款已繳:'taxUnpaid',收件完成:'unreceived',本期工作完成:'today'}[type]||'unpaid';return {id:uid('done'),periodId:p.id,periodClientId:pc.id,clientName:pc.snapshot?.name||'',periodLabel:periodLabel(p),type,priority:PRIORITY_LABELS[priorityOf(event,p)]||'今天要處理',completedAt:at,result,createdAt:at,updatedAt:at};}
 function commitBulk(input,initialRows,initialPeriod){return new Promise((resolve,reject)=>{
  const needsSettings=input.action==='receipt',tr=db.transaction(['periodClients','periods','completed',...needsSettings?['settings']:[]],'readwrite'),store=tr.objectStore('periodClients'),periodStore=tr.objectStore('periods');let rows,periods,settingsRows,result,failed=false;
  const abort=error=>{failed=true;try{tr.abort()}catch{}reject(error)};
  const build=()=>{
   if(!rows||!periods||needsSettings&&!settingsRows||failed)return;const oldRows=state.periodClients,oldPeriods=state.periods,oldSettings=state.settings;
   try{
    const period=periods.find(p=>p.id===input.periodId);if(!period||JSON.stringify(period)!==JSON.stringify(initialPeriod))throw new Error('期別資料已更新，請關閉後重新開啟批次登記');
    for(const entry of input.entries){const current=rows.find(pc=>pc.id===entry.pcId),initial=initialRows.find(pc=>pc.id===entry.pcId);if(!current||JSON.stringify(current)!==JSON.stringify(initial))throw new Error((initial?.snapshot?.name||'客戶')+' 的資料已更新，請關閉後重新開啟，避免覆蓋其他變更');}
    const at=nowISO(),request={...input,entries:input.entries.map(entry=>({...entry,...input.action==='payment'?{paymentId:uid('pay')}:input.action==='receipt'?{historyId:uid('rsh')}:{}}))};
    if(needsSettings){const settings=settingsRows[0];if(!settings)throw new Error('設定已不存在，請重新整理');state.settings=settings;}
    result=policy.plan(request,{periodClients:rows,periods,receiptStatuses:state.settings.receiptStatuses},at);if(!result.changes.length)throw new Error('選取的資料與原資料相同，無需儲存');
    const changed=new Set(result.changes.map(x=>x.next.id)),affectedPeriods=new Set([period.id]),completions=[];
    state.periods=periods;
    if(input.action==='tax'||input.action==='payment'){
     const clientIds=new Set(result.changes.map(x=>x.next.clientId)),beforeLedgers=new Map();state.periodClients=clone(rows);
     for(const clientId of clientIds)beforeLedgers.set(clientId,computeClientLedgerV19(clientId));
     state.periodClients=result.periodClients;
     const originalFees=new Map(rows.map(pc=>[pc.id,JSON.stringify(pc.fees||[])]));
     for(const clientId of clientIds){
      const ledger=computeClientLedgerV19(clientId);if([...ledger.values()].some(item=>(item.conflicts||[]).length))throw new Error('本次變更會影響已保存的沖銷來源，整批尚未儲存；請先核對相關付款');
      for(const pc of result.periodClients.filter(pc=>pc.clientId===clientId)){
       const snapshot=ledger.get(pc.id);if(!snapshot)continue;
       if(JSON.stringify(pc.openingSnapshot210||[])!==JSON.stringify(snapshot.openingItems)||originalFees.get(pc.id)!==JSON.stringify(pc.fees||[])){
        const p=periods.find(x=>x.id===pc.periodId);if(p?.status==='已結束'&&!p.unlocked&&p.id!==period.id)throw new Error('本次變更會影響已結束後期的承接餘額，請先解鎖該期');
        pc.openingSnapshot210=clone(snapshot.openingItems);changed.add(pc.id);affectedPeriods.add(pc.periodId);
       }
       if(input.action==='payment')for(const pay of pc.payments||[])if(request.entries.some(entry=>entry.paymentId===pay.id)){const saved=snapshot.paymentSnapshots.find(item=>item.paymentId===pay.id);if(!saved)throw new Error('找不到本次付款的沖款預覽，整批尚未儲存');pay.allocationRecord={version:1,fingerprint:paymentFingerprint210(pay),confirmedAt:at,legacyBaseline:false,allocations:clone(saved.allocations),itemsBefore:clone(saved.itemsBefore),itemsAfter:clone(saved.itemsAfter),unapplied:saved.unapplied};}
       if(result.changes.some(x=>x.next.id===pc.id)&&(beforeLedgers.get(clientId).get(pc.id)?.currentRemaining||0)>0&&snapshot.currentRemaining===0&&totalDue(pc)>0)completions.push(completedRecord(pc,period,'本期款項收齊','本期應收已沖清',at));
      }
     }
    }
    const linked=planPeriodLinks218(rows,result.periodClients,periods,[...changed],at,{baselineRows:rows.map(pc=>initialRows.find(x=>x.id===pc.id)||pc)});result.periodClients=linked.periodClients;for(const id of linked.changedIds)changed.add(id);
    state.periodClients=result.periodClients;
    for(const {old,next}of result.changes){if(input.action==='receipt'&&!isReceiptComplete(old)&&isReceiptComplete(next))completions.push(completedRecord(next,period,'收件完成',receiptStatusName(next),at));if(input.action==='notes'&&!old.caseClosed&&next.caseClosed)completions.push(completedRecord(next,period,'本期工作完成',debt(next)>0?'本期工作已完成；尚欠持續跨期追蹤 '+money(debt(next))+' 元':'已完成',at));}
    for(const id of changed){const next=result.periodClients.find(pc=>pc.id===id),old=rows.find(pc=>pc.id===id);groups.assertUnchanged(old,next);next.updatedAt=at;store.put(preparedPC210(next,old));}
    if(input.action==='paid')for(const {next}of result.changes)completions.push(completedRecord(next,period,'稅款已繳',money(next.taxPaidAmount)+' 元',at));
    for(const record of completions)tr.objectStore('completed').put(record);
    for(const p of periods)if(affectedPeriods.has(p.id)&&p.status==='已結束'&&p.unlocked){const next=clone(p);next.unlocked=false;next.relockedAt=at;const last=next.unlockHistory?.at(-1);if(last&&!last.relockedAt)last.relockedAt=at;periodStore.put(next);}
   }catch(error){abort(error)}finally{state.periodClients=oldRows;state.periods=oldPeriods;state.settings=oldSettings}
  };
  const rr=store.getAll(),pr=periodStore.getAll();rr.onsuccess=()=>{rows=rr.result;build()};pr.onsuccess=()=>{periods=pr.result;build()};
  if(needsSettings){const sr=tr.objectStore('settings').getAll();sr.onsuccess=()=>{settingsRows=sr.result;build()};}
  tr.oncomplete=()=>resolve(result.changes.length);tr.onabort=()=>{if(!failed)reject(tr.error||new Error('整批未完成儲存，請保留畫面後重試'))};tr.onerror=()=>{};
 });}
 function workToolbar(){
  if($('#bulkWork215'))return;const anchor=$('#workCommonSettings');if(!anchor)return;
  const bar=vatElement214('section','bulk-work-toolbar215');bar.id='bulkWork215';bar.setAttribute('aria-label','本期批次登記');bar.dataset.reviewId='vat-workbench-bulkWork215';bar.dataset.reviewName='本期批次登記';
  bar.innerHTML='<strong>批次登記</strong><div class="actions">'+[['receipt','收發票'],['date','建立日期'],['tax','稅額登記'],['carry','跨期事項'],['paid','繳納'],['payment','客戶付款'],['notes','補充事項']].map(([action,label])=>`<button type="button" class="btn ${action==='paid'?'primary':''}" data-bulk-work215="${action}">${label}</button>`).join('')+'</div>';
  anchor.insertAdjacentElement('afterend',bar);
 }
 const renderBefore=renderWork;renderWork=function(){renderBefore();workToolbar();};
 for(const [name,action]of [['renderReceiptBody','receipt'],['renderBillingBody','tax'],['renderTaxPayBody','paid'],['renderCarryoverBody','carry'],['renderPaymentBody','payment']]){
  // Functions live in the original standalone script's lexical scope.
  const before=name==='renderReceiptBody'?renderReceiptBody:name==='renderBillingBody'?renderBillingBody:name==='renderTaxPayBody'?renderTaxPayBody:name==='renderCarryoverBody'?renderCarryoverBody:renderPaymentBody;
  const label={receipt:'批次收發票',tax:'批次登記稅額',paid:'批次登記繳納',carry:'批次跨期事項',payment:'批次客戶付款'}[action];
  const wrapped=(...args)=>`<div class="bulk-work-entry215"><button type="button" class="btn small" data-bulk-work215="${action}">${label}</button></div>`+before(...args);
  if(name==='renderReceiptBody')renderReceiptBody=wrapped;else if(name==='renderBillingBody')renderBillingBody=wrapped;else if(name==='renderTaxPayBody')renderTaxPayBody=wrapped;else if(name==='renderCarryoverBody')renderCarryoverBody=wrapped;else renderPaymentBody=wrapped;
 }
 const detailBefore=renderWorkDetail;renderWorkDetail=function(){detailBefore();const panel=$('#workDetail [data-focus-panel="notes"] .section-body');if(panel&&!panel.querySelector('[data-bulk-work215="notes"]'))panel.insertAdjacentHTML('afterbegin','<div class="bulk-work-entry215"><button type="button" class="btn small" data-bulk-work215="notes">批次補充事項</button></div>');};
 function openBulk(action){
  if(!allowPeriodEntry214())return;const p=currentPeriod();if(!p){toast('請先選擇期別');return}if(p.status==='已結束'&&!p.unlocked){toast('此期已結束，請先解鎖再批次登記');return}
  const initialRows=clone(pcForPeriod()),initialPeriod=clone(p),root=$('#modalRoot');let field='appointmentDate',busy=false;
  const title={date:'批次建立日期',tax:'批次稅額登記',paid:'批次登記繳納'}[action];
  showModal(title,`<div id="bulkWorkForm215" data-review-id="vat-workbench-bulkWorkForm215" data-review-name="批次客戶登記"><p class="bulk-work-period215">${esc(periodLabel(p))}</p><div class="bulk-work-controls215">${action==='date'?`<div class="field"><label for="bulkDateField215">日期欄位</label><select id="bulkDateField215" class="select">${Object.entries(dateFields).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></div>`:''}${action!=='tax'?`<div class="field"><label for="bulkDate215">${action==='paid'?'實際繳納日期':'共用日期'}</label><input id="bulkDate215" class="input" type="date" value="${localDate()}"></div>${action==='date'?'<button type="button" id="bulkApplyDate215" class="btn">套用至已勾選</button>':''}`:''}<div class="field"><label for="bulkSearch215">搜尋客戶</label><input id="bulkSearch215" type="search" class="input" placeholder="代號、名稱、聯絡人"></div><div class="field"><label for="bulkState215">顯示資料</label><select id="bulkState215" class="select"><option value="all">全部</option><option value="missing">${action==='paid'?'尚未繳納':action==='tax'?'未登記稅額':'未建立日期'}</option><option value="set">${action==='paid'?'已繳納':action==='tax'?'已登記稅額':'已建立日期'}</option></select></div></div><div class="bulk-work-selection215"><button type="button" id="bulkSelectVisible215" class="btn small">勾選符合客戶</button><button type="button" id="bulkClearSelection215" class="btn small">清除勾選</button><strong id="bulkCount215" role="status"></strong></div><div class="bulk-work-table215"><table><thead><tr><th>選取</th><th>客戶</th><th>目前資料</th>${action!=='paid'?`<th>${action==='tax'?'本期稅額':'登記日期'}</th>`:''}</tr></thead><tbody id="bulkRows215"></tbody></table><p id="bulkEmpty215" class="empty" hidden>沒有符合客戶</p></div><p class="bulk-work-help215">${action==='paid'?'只登記已完成繳納；每家依本期稅額記錄，不新增客戶匯款。只有正數應繳且尚未繳納的客戶可勾選。':action==='tax'?'逐家填寫稅額；0 是已登記，負數為留底。已繳納的稅額請回個別明細調整。':'可使用共用日期，或逐家調整；只儲存已勾選客戶。'}</p><p id="bulkError215" class="notice warn" role="alert" hidden></p></div>`,[{text:'取消',value:false},{text:'儲存勾選客戶',value:true,cls:'primary'}],()=>{});
  const dialog=root.querySelector('.modal');dialog.classList.add('bulk-work-modal215');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',title);
  const save=root.querySelector('.modal-foot button:last-child'),error=$('#bulkError215');
  const snapshot=()=>JSON.stringify([...dialog.querySelectorAll('.bulk-choice215,.bulk-value215,#bulkDate215,#bulkDateField215')].map(el=>el.type==='checkbox'?el.checked:el.value));let baseline;
  const close=()=>{if(busy)return;if(snapshot()!==baseline&&!confirm('批次登記尚未儲存，確定捨棄這次變更？'))return;root.classList.remove('show');root.innerHTML=''};
  root.querySelector('[data-close]').onclick=close;root.querySelector('.modal-foot button').onclick=close;root.onclick=e=>{if(e.target===root)close()};
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}else if(e.key==='Tab'){const nodes=[...dialog.querySelectorAll('input,select,button')].filter(el=>!el.disabled&&el.getClientRects().length);if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus()}}});
  function rowEditable(pc){return policy.eligible(pc,action)&&!(action==='tax'&&pc.taxPaid)}
  function renderRows(){
   $('#bulkRows215').innerHTML=initialRows.map(pc=>{const c=pc.snapshot||{},editable=rowEditable(pc),current=action==='date'?(policy.validDate(pc[field])?fmtDate(pc[field]):'尚未建立'):action==='paid'?(pc.taxPaid?'已繳 '+fmtDate(pc.taxPaidDate):'未繳')+'｜'+taxText(pc):taxText(pc),value=action==='date'?pc[field]||'':policy.hasTax(pc)?pc.taxAmount:'';
    return `<tr data-pcid="${esc(pc.id)}"><td><label class="bulk-choice-hit215"><input class="bulk-choice215" type="checkbox" aria-label="勾選 ${esc(c.code||'')} ${esc(c.name||'')}" ${editable?'':'disabled'}></label></td><td><div class="bulk-client-name215">${esc(c.name||'未命名客戶')}</div><div class="bulk-client-code215">${esc(c.code||'無代號')}</div><div class="bulk-client-contact215">${esc(contactSummary(c)||'未填聯絡人')}</div>${pc.notApplicable?'<span class="badge b-gray">本期不適用</span>':''}${action==='tax'&&pc.taxPaid?'<span class="badge b-gray">已繳，請至明細調整</span>':''}</td><td>${esc(current)}</td>${action!=='paid'?`<td><input class="input bulk-value215" ${action==='date'?'type="date"':'inputmode="decimal" maxlength="22"'} value="${esc(value)}" aria-label="${esc(c.name||c.code||'客戶')} ${action==='tax'?'稅額':dateFields[field]}" ${editable?'':'disabled'}></label></td>`:''}</tr>`}).join('');
   for(const row of $$('#bulkRows215 tr')){const choice=row.querySelector('.bulk-choice215'),value=row.querySelector('.bulk-value215');choice.onchange=()=>{if(action==='date'&&choice.checked&&!value.value)value.value=$('#bulkDate215').value;updateCount()};if(value)value.oninput=()=>{choice.checked=true;value.removeAttribute('aria-invalid');updateCount()};}
   filterRows();
  }
  function filterRows(){const q=$('#bulkSearch215').value.trim().toLowerCase(),status=$('#bulkState215').value;for(const row of $$('#bulkRows215 tr')){const pc=initialRows.find(x=>x.id===row.dataset.pcid),set=action==='date'?policy.validDate(pc[field]):action==='tax'?policy.hasTax(pc):!!pc.taxPaid,search=[pc.snapshot?.code,pc.snapshot?.name,contactSummary(pc.snapshot||{})].join(' ').toLowerCase();row.hidden=!!q&&!search.includes(q)||status==='set'&&!set||status==='missing'&&set;}updateCount();}
  function updateCount(){const rows=$$('#bulkRows215 tr'),selected=rows.filter(row=>row.querySelector('.bulk-choice215').checked),visible=rows.filter(row=>!row.hidden);$('#bulkCount215').textContent=`已勾選 ${selected.length} 家｜目前顯示 ${visible.length} 家${selected.some(row=>row.hidden)?'（含搜尋外的勾選）':''}`;$('#bulkEmpty215').hidden=visible.length>0;save.disabled=!selected.length;}
  $('#bulkSearch215').oninput=filterRows;$('#bulkState215').onchange=filterRows;$('#bulkSelectVisible215').onclick=()=>{for(const row of $$('#bulkRows215 tr'))if(!row.hidden){const choice=row.querySelector('.bulk-choice215');if(!choice.disabled){choice.checked=true;const value=row.querySelector('.bulk-value215');if(action==='date'&&!value.value)value.value=$('#bulkDate215').value;}}updateCount()};$('#bulkClearSelection215').onclick=()=>{$$('.bulk-choice215').forEach(el=>el.checked=false);updateCount()};
  if(action==='date'){$('#bulkApplyDate215').onclick=()=>{const value=$('#bulkDate215').value;if(!policy.validDate(value)){error.textContent='請先填寫有效共用日期';error.hidden=false;return}for(const row of $$('#bulkRows215 tr'))if(row.querySelector('.bulk-choice215').checked)row.querySelector('.bulk-value215').value=value;error.hidden=true;};$('#bulkDateField215').onchange=event=>{const next=event.target.value;event.target.value=field;if(snapshot()!==baseline&&!confirm('切換日期欄位會清空本次批次草稿，是否繼續？'))return;field=next;event.target.value=field;renderRows();baseline=snapshot();};}
  renderRows();baseline=snapshot();
  save.onclick=async()=>{
   if(busy)return;const entries=[];
   for(const row of $$('#bulkRows215 tr'))if(row.querySelector('.bulk-choice215').checked){const input=row.querySelector('.bulk-value215');if(input){try{if(action==='tax')policy.amount(input.value);else if(!policy.validDate(input.value))throw new Error('請填寫有效日期')}catch(e){input.setAttribute('aria-invalid','true');input.focus();error.textContent=row.querySelector('.bulk-client-name215').textContent+'：'+e.message;error.hidden=false;return}}entries.push({pcId:row.dataset.pcid,value:input?.value});}
   const request={periodId:p.id,action,dateField:field,date:$('#bulkDate215')?.value,entries};busy=true;error.hidden=true;const controls=[...dialog.querySelectorAll('input,select,button')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);
   try{const count=await commitBulk(request,initialRows,initialPeriod);let refreshed=true;try{await loadAll()}catch{refreshed=false}baseline=snapshot();root.classList.remove('show');root.innerHTML='';toast(`已儲存 ${count} 家客戶的${action==='date'?dateFields[field]:action==='tax'?'本期稅額':'繳納紀錄'}${refreshed?'':'；畫面更新失敗，請重新整理，勿重複登記'}`)}catch(e){error.textContent=e.message||'整批尚未儲存，請保留輸入後再試';error.hidden=false}finally{busy=false;controls.forEach(([el,disabled])=>{if(el.isConnected)el.disabled=disabled});}
  };
  dialog.querySelector('#bulkSearch215').focus();
 }
 document.addEventListener('click',event=>{const button=event.target.closest('[data-bulk-work215]');if(!button)return;const action=button.dataset.bulkWork215;if(['receipt','carry','payment','notes'].includes(action))openBulkModule216(action,{policy,commitBulk});else openBulk(action);});
 function mountExportFilters(){
  if($('#exportFilters215'))return;const search=$('#txtClientSearch');if(!search)return;const box=vatElement214('div','export-filters215');box.id='exportFilters215';
  box.innerHTML=`<div class="field"><label for="exportDateField215">日期欄位</label><select id="exportDateField215" class="select">${Object.entries(dateFields).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></div><div class="field"><label for="exportDateStatus215">日期狀態</label><select id="exportDateStatus215" class="select"><option value="all">全部日期狀態</option><option value="set">已建立日期</option><option value="missing">未建立日期</option></select></div><div class="field"><label for="exportTaxStatus215">稅額狀態</label><select id="exportTaxStatus215" class="select"><option value="all">全部稅額狀態</option><option value="set">已登記稅額（含 0、留底）</option><option value="missing">未登記稅額</option></select></div><p id="exportFilterCount215" class="small" role="status"></p>`;
  search.insertAdjacentElement('beforebegin',box);
  for(const [id,key]of [['exportDateField215','dateField'],['exportDateStatus215','date'],['exportTaxStatus215','tax']]){$('#'+id).value=filters[key];$('#'+id).onchange=event=>{filters[key]=event.target.value;renderTxtClientOptions();};}
 }
 const summaryBefore=updateExportSummary;
 updateExportSummary=function(){summaryBefore();const select=$('#txtClients'),hint=$('#exportFilterCount215');if(select&&hint)hint.textContent=`目前符合 ${select.options.length} 家；已選 ${select.selectedOptions.length} 家。${collectionExport213()?'提醒收發票仍依目標日期及收件狀態篩選。':''}`;};
 const renderExportClientsBefore=renderTxtClientOptions;
 renderTxtClientOptions=function(){mountExportFilters();renderExportClientsBefore();const select=$('#txtClients');if(!select)return;for(const option of [...select.options]){const pc=state.periodClients.find(pc=>pc.id===option.value);if(!pc||!policy.matches(pc,filters))option.remove();}select.onchange=updateExportSummary;updateExportSummary();};
 const exportBefore=exportTemplateTxt;
 exportTemplateTxt=function(){const period=currentPeriod(),ids=[...($('#txtClients')?.selectedOptions||[])].map(option=>option.value);if(ids.some(id=>{const pc=state.periodClients.find(x=>x.id===id);return !pc||pc.periodId!==period?.id||pc.notApplicable||!policy.matches(pc,filters)})){toast('客戶資料或篩選已變更，請重新確認名單');renderTxtClientOptions();return}return exportBefore();};
})();
/* VAT_BULK_WORK215_END */
