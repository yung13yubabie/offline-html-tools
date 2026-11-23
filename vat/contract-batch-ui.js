/* Create every row under one customer in a single contract transaction. */
function openLeaseBatch228(clientId=''){
 if(!state.clients.length){toast('請先在客戶庫新增客戶');return;}
 const origin=document.activeElement,root=$('#modalRoot'),defaults=leaseEngine224.defaultLease();
 const settings=[
  ['clientId','客戶','<option value="">選擇客戶</option>'+recordClientOptions220(clientId)],
  ['categoryId','類別',contractTypeOptions220('lease')],
  ['frequency','核對週期',leaseEngine224.frequencies.map(key=>leaseOption224(key,leaseFrequency224[key],defaults.frequency)).join('')],
  ['rentBasis','月租基準',leaseOption224('net','未稅',defaults.rentBasis)+leaseOption224('gross','含稅',defaults.rentBasis)],
  ['regime','押息計算方式',leaseOption224('invoice','一般稅額',defaults.regime)+leaseOption224('assessed','查定計算',defaults.regime)]
 ];
 const columns=[['title','合約／據點名稱'],['startDate','開始日'],['endDate','到期日'],['rent','月租（元）'],['deposit','押金（元）']];
 showModal('批量新增租約',`<form id="leaseBatchForm228" novalidate>
  <section class="lease-batch-settings228" aria-labelledby="leaseBatchCommon228">
   <h3 id="leaseBatchCommon228">共通設定</h3>
   <div class="lease-batch-fields228">
    ${settings.map(([key,label,options])=>`<label class="field">${label}<select class="select" name="${key}">${options}</select></label>`).join('')}
    <label class="field">提前提醒（月）<input class="input" type="number" name="leadMonths" value="1" min="0" max="36" step="1"></label>
   </div>
   <div class="lease-batch-apply228"><button class="btn" type="button" id="leaseBatchApply228">套用至所有列</button>
    <output id="leaseBatchApplied228" role="status"></output></div>
  </section>
  <div class="lease-batch-table228">
   <div class="lease-batch-columns228" aria-hidden="true">${columns.map(([,label])=>`<span>${label}</span>`).join('')}<span>操作</span></div>
   <div id="leaseBatchRows228"></div>
  </div>
  <button type="button" class="btn" id="leaseBatchAdd228">＋ 新增一列</button>
  <p id="leaseBatchError228" class="notice warn" role="alert" tabindex="-1" hidden></p>
 </form>`,[{text:'取消',value:false},{text:'確認建立',value:true,cls:'primary'}],()=>{});
 const modal=root.querySelector('.modal'),form=$('#leaseBatchForm228'),list=$('#leaseBatchRows228'),error=$('#leaseBatchError228');
 const footer=modal.querySelector('.modal-foot'),[cancel,save]=footer.querySelectorAll('button');
 modal.classList.add('lease-modal224','lease-batch-modal228');
 modal.setAttribute('role','dialog');
 modal.setAttribute('aria-labelledby','leaseBatchTitle228');
 modal.querySelector('.modal-title').id='leaseBatchTitle228';
 modal.querySelector('[data-close]').setAttribute('aria-label','關閉');
 save.id='leaseBatchSave228';
 const count=document.createElement('output');
 count.className='lease-batch-count228';count.setAttribute('aria-live','polite');footer.prepend(count);
 const rows=()=>[...list.children];
 const common=key=>form.elements.namedItem(key);
 const read=row=>Object.fromEntries(columns.map(([key])=>[key,row.querySelector(`[data-batch-field="${key}"]`).value]));
 const snapshot=()=>JSON.stringify([...settings.map(([key])=>common(key).value),common('leadMonths').value,rows().map(read)]);
 let busy=false,serial=0;
 function drawCount(){
  const size=list.childElementCount;
  count.textContent='預計建立 '+size+' 筆';
  save.disabled=!size;
  for(const [index,row] of rows().entries()){
   row.querySelector('legend').textContent='第 '+(index+1)+' 列';
  }
 }
 function addRow(values={},after=null){
  const index=++serial;
  const row=document.createElement('fieldset');
  row.className='lease-batch-row228';
  row.innerHTML=`<legend></legend><div class="lease-batch-row-fields228">${columns.map(([key,label])=>`
   <label class="field"><span>${label}</span><input class="input" data-batch-field="${key}" type="${key.endsWith('Date')?'date':'text'}"
    ${key==='title'?'maxlength="200"':key.endsWith('Date')?'':'inputmode="decimal"'}
    aria-describedby="lease-batch-row-error-${index}" value="${esc(values[key]||'')}"></label>`).join('')}
   <div class="lease-batch-row-actions228"><button type="button" class="btn ghost" data-batch-copy>複製此列</button>
    <button type="button" class="btn ghost danger" data-batch-remove>刪除</button></div></div>
   <p class="contract-field-error220" id="lease-batch-row-error-${index}" hidden></p>`;
  if(after)after.after(row);
  else list.append(row);
  drawCount();
  return row.querySelector('input');
 }
 function commonValues(requireClient){
  const selected=common('clientId').value;
  if(requireClient&&!clientById(selected)){
   common('clientId').focus();
   throw Error('請選擇客戶庫中的客戶');
  }
  let leadMonths;
  try{leadMonths=contractEngine220.months(common('leadMonths').value);}
  catch(failure){common('leadMonths').focus();throw failure;}
  return {clientId:selected,categoryId:common('categoryId').value,leadMonths,
   lease:{...defaults,frequency:Number(common('frequency').value),rentBasis:common('rentBasis').value,regime:common('regime').value}};
 }
 function showError(message){
  error.textContent=message;error.hidden=false;
 }
 function clearRow(row){
  row.querySelector('p').hidden=true;
  row.querySelector('[aria-invalid]')?.removeAttribute('aria-invalid');
 }
 function showRowError(row,index,failure){
  const hint=row.querySelector('p');
  hint.textContent='第 '+(index+1)+' 列 · '+failure.message;
  hint.hidden=false;
  const target=row.querySelector(`[data-batch-field="${failure.field||'title'}"]`)||row.querySelector('input');
  target.setAttribute('aria-invalid','true');
  return target;
 }
 function prepare(row,shared){
  const data=read(row);
  const {title,startDate,endDate}=data;
  if(!title.trim())throw Object.assign(Error('請填寫合約／據點名稱'),{field:'title'});
  if(!startDate)throw Object.assign(Error('請填寫開始日'),{field:'startDate'});
  if(!endDate||endDate<startDate)throw Object.assign(Error('到期日須等於或晚於開始日'),{field:'endDate'});
  const amount=key=>{
   try{return leaseEngine224.amount(data[key]);}
   catch{throw Object.assign(Error('金額須為非負數，最多兩位小數'),{field:key});}
  };
  const rent=amount('rent'),deposit=amount('deposit');
  const lease={...shared.lease,deposit,steps:rent===null?[]:[{from:startDate,cents:rent}]};
  return {id:uid('contract'),...shared,title,startDate,endDate,closed:false,reminderEnabled:true,
   task:'確認續約或結案',note:'',lease};
 }
 addRow();
 const initial=snapshot(),applied=$('#leaseBatchApplied228');
 function close(){
  if(busy||snapshot()!==initial&&!window.confirm('批量新增尚未儲存，確定關閉？'))return;
  root.classList.remove('show');root.replaceChildren();
  if(origin?.isConnected)origin.focus();
 }
 cancel.onclick=close;
 modal.querySelector('[data-close]').onclick=close;
 root.onclick=event=>{if(event.target===root)close();};
 modal.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();close();}};
 form.oninput=event=>{
  error.hidden=true;
  const row=event.target.closest('.lease-batch-row228');
  if(row)clearRow(row);
  else applied.textContent='';
 };
 $('#leaseBatchApply228').onclick=()=>{
  error.hidden=true;
  try{commonValues(false);applied.textContent='共通設定已套用至 '+list.childElementCount+' 列';}
  catch(failure){showError(failure.message);}
 };
 $('#leaseBatchAdd228').onclick=()=>{applied.textContent='';addRow().focus();};
 list.onclick=event=>{
  const row=event.target.closest('.lease-batch-row228');
  if(!row)return;
  if(event.target.closest('[data-batch-copy]'))addRow(read(row),row).focus();
  else if(event.target.closest('[data-batch-remove]')){
   const next=row.nextElementSibling||row.previousElementSibling;
   row.remove();
   drawCount();
   (next?.querySelector('[data-batch-remove]')||$('#leaseBatchAdd228')).focus();
  }else return;
  applied.textContent='';error.hidden=true;
 };
 async function commit(event){
  event?.preventDefault();
  if(busy||!list.childElementCount)return;
  error.hidden=true;
  let shared;
  try{shared=commonValues(true);}
  catch(failure){showError(failure.message);return;}
  const inputs=rows(),drafts=[];
  let invalid;
  for(const [index,row] of inputs.entries()){
   clearRow(row);
   try{drafts.push(prepare(row,shared));}
   catch(failure){const target=showRowError(row,index,failure);invalid??=target;}
  }
  if(invalid){invalid.focus();return;}
  busy=true;
  const controls=[...modal.querySelectorAll('button,input,select')].filter(control=>!control.disabled);
  controls.forEach(control=>control.disabled=true);
  try{await writeContract220({drafts});}
  catch(failure){
   busy=false;
   controls.forEach(control=>control.disabled=false);
   if(Number.isInteger(failure.row))showRowError(inputs[failure.row],failure.row,failure).focus();
   else{showError(failure.message||'批量新增未儲存');error.focus();}
   return;
  }
  root.classList.remove('show');root.replaceChildren();
  Object.assign(contractRuntime220,{query:'',clientId:shared.clientId,categoryId:'',year:'',status:'all',page:1});
  contractRuntime220.folders.set(shared.clientId,true);
  const folder=$$('#contractsList220 [data-client-folder222]').find(node=>node.dataset.clientFolder222===shared.clientId);
  if(folder)folder.open=true;
  $('#contractSearch220').value='';
  try{
   await loadAll();
   $('#contractsList220 [data-lease-batch228]')?.focus({preventScroll:true});
   toast('已建立 '+drafts.length+' 筆租約');
  }catch{toast('租約已儲存，請重新整理工作台');}
 }
 save.onclick=()=>commit();
 form.onsubmit=commit;
 (clientId?list.querySelector('input'):common('clientId')).focus();
}
