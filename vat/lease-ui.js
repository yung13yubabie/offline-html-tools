const leaseEngine224=createLeaseEngine224();
const leaseRates224=()=>state.leaseRates||[];
const leaseMoney224=cents=>cents===null?'待填':(cents/100).toLocaleString('zh-TW',{maximumFractionDigits:2})+' 元';
const leaseYear224=year=>fmtDate(year+'-01-01').split('/')[0]+' 年';
const leaseRange224=period=>fmtDate(period.start)+' ～ '+fmtDate(period.end);
const rentBasisLabel234=basis=>basis==='gross'?'含稅':'未稅';
const rentMonthLabel234=month=>fmtDate(month.begin).split('/').slice(0,2).join('/');
const interestRateNeeded235=period=>period.interestRows.some(row=>row.needsRate)||(period.hasLegacyInterest&&period.needsRate);
const leaseOption224=(value,label,selected)=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`;
const leaseFrequency224={1:'每月',2:'雙月',3:'每季',12:'每年'};
const leaseOutcomes224={
 unknown:['待補設定','gray'],pending:['待核對','gray'],matched:['金額相符','green'],
 missing:['未開發票','red'],different:['金額有差異','orange']
};
function leasePeriodStatus224(period){
 const outcomes=[period.rentResult,period.interestResult];
 if(outcomes.includes('missing'))return 'missing';
 if(outcomes.includes('different'))return 'different';
 if(interestRateNeeded235(period)&&outcomes.includes('unknown'))return 'unknown';
 const interest=period.hasLegacyInterest&&!period.hasMonthlyInterest?period.interest:period.interestSalesTotal;
 if(outcomes.every(value=>value==='matched')||
   outcomes.includes('matched')&&(period.rent===null||interest===null))return 'matched';
 return 'pending';
}
function leaseOutcomeBadge224(outcome){return statusBadge(...leaseOutcomes224[outcome]);}
function leaseRentDisplay225(contract,today=localDate()){
 const lease=contract.lease;
 if(!lease?.steps.length)return {label:'月租',value:'未填'};
 const date=today<contract.startDate?contract.startDate:today;
 const step=lease.steps.reduce((latest,item)=>item.from<=date&&(!latest||item.from>latest.from)?item:latest,null);
 let label='月租';
 if(lease.steps.length>1)label=today<contract.startDate?'起租月租':today>contract.endDate?'末段月租':'目前月租';
 const basis=contract.rental?.kind==='individual'?'':' · '+rentBasisLabel234(lease.rentBasis);
 return {label,value:leaseMoney224(step.cents)+basis};
}
const rentChangeLabel233=change=>change.difference>0?'租金調漲':'租金調降';
const rentChangeAmounts233=change=>leaseMoney224(change.before)+' → '+leaseMoney224(change.after);
function rentChangeSchedule233(contract){
 const changes=leaseEngine224.rentChanges(contract.lease);
 if(!changes.length)return '';
 return `<div class="lease-changes233"><h3>租金調整</h3><ul>${changes.map(change=>{
  const reminder=contractEngine220.rentReminderDate(change);
  const amount=(change.difference>0?'+':'−')+leaseMoney224(Math.abs(change.difference));
  return `<li>
   <time datetime="${esc(change.date)}">${esc(fmtDate(change.date))} 生效</time>
   <span class="lease-change-amount233"><strong>${esc(rentChangeAmounts233(change))}</strong>
    ${statusBadge(rentChangeLabel233(change)+' '+amount,change.difference>0?'orange':'blue')}</span>
   <small>${esc(change.doneAt?'提醒已確認':contract.closed?'提醒已停止':reminder?'提醒 '+fmtDate(reminder):'提醒關閉')}</small>
  </li>`;
 }).join('')}</ul></div>`;
}
function leaseSummary224(contract){
 const data=contract.lease;
 const personal=contract.rental?.kind==='individual',rent=leaseRentDisplay225(contract);
 if(!data&&!personal)return '';
 const periods=personal?[]:leaseEngine224.calculate(contract,leaseRates224());
 const issues=periods.filter(period=>['missing','different'].includes(leasePeriodStatus224(period))).length;
 return `<dl class="lease-summary224">
  <div><dt>${esc(rent.label)}</dt><dd>${esc(rent.value)}</dd></div>
  <div><dt>押金本金</dt><dd>${esc(leaseMoney224(data?.deposit??null))}</dd></div>
  ${personal?`<div><dt>給付核對</dt><dd>${contract.leasePayments?.length||0} 筆</dd></div>`:
   `<div><dt>${esc(leaseFrequency224[data.frequency])}核對</dt><dd>${issues?statusBadge('待處理','orange')+' '+issues+' 期':periods.length+' 期'}</dd></div>`}
 </dl>${rentChangeSchedule233(contract)}`;
}
function bindLeaseRates224(button){
 if(button)button.onclick=()=>{
  const menu=button.closest('details');
  if(menu){menu.open=false;menu.querySelector('summary').focus();}
  openLeaseRates224();
 };
}
function commitLeaseRate224(id,rate,baseline){
 return new Promise((resolve,reject)=>{
  const transaction=db.transaction('leaseRates','readwrite'),store=transaction.objectStore('leaseRates'),read=store.get(id);
  let failure;
  read.onsuccess=()=>{
   if(JSON.stringify(read.result)!==JSON.stringify(baseline)){
    failure=Error('此年度利率已在其他分頁更新，請重新開啟後再操作');transaction.abort();return;
   }
   if(rate===null)store.delete(id);
   else store.put({id,rate});
  };
  transaction.oncomplete=resolve;
  transaction.onabort=()=>reject(failure||transaction.error||Error('年度利率未儲存'));
 });
}
function openLeaseRates224(){
 const origin=document.activeElement;
 const initialRows=new Map(leaseRates224().map(row=>[row.id,row]));
 const initialYear=localDate().slice(0,4);
 showModal('年度郵政利率',`<div class="lease-rate-panel224">
  <div class="lease-rate-list224" id="leaseRateList224"></div>
  <div class="lease-fields224">
   <label class="field">年度<input class="input" id="leaseRateYear224" inputmode="numeric" maxlength="4" value="${esc(initialYear)}" placeholder="西元 2026 或民國 115"></label>
   <label class="field">1 月 1 日一年期固定利率（%）<input class="input" id="leaseRateValue224" inputmode="decimal"></label>
  </div>
  <p class="notice warn" id="leaseRateError224" role="alert" hidden></p>
 </div>`,[{text:'關閉',value:false},{text:'儲存利率',value:true,cls:'primary'}],()=>{});
 const modal=$('#modalRoot .modal'),root=$('#modalRoot'),year=$('#leaseRateYear224'),value=$('#leaseRateValue224');
 const [cancel,save]=modal.querySelectorAll('.modal-foot button'),list=$('#leaseRateList224'),error=$('#leaseRateError224');
 modal.classList.add('lease-rate-modal224');
 save.id='saveLeaseRate224';
 let busy=false;
 function yearId(){
  const input=year.value.normalize('NFKC').trim();
  if(!/^\d{1,4}$/.test(input)||!Number(input))throw Error('請輸入有效的西元或民國年度');
  return String(input.length<4?Number(input)+1911:Number(input)).padStart(4,'0');
 }
 function fill(){
  let saved;
  try{saved=initialRows.get(yearId());}catch{}
  value.value=leaseEngine224.format(saved?.rate,4);
  error.hidden=true;
 }
 function renderRates(){
  list.innerHTML=[...initialRows.values()].sort((a,b)=>b.id.localeCompare(a.id)).map(row=>
   `<button type="button" class="btn" data-lease-rate-year="${esc(row.id)}">${esc(leaseYear224(row.id))} <strong>${esc(leaseEngine224.format(row.rate,4))}%</strong></button>`).join('');
 }
 function close(){
  if(busy)return;
  root.classList.remove('show');root.replaceChildren();
  if(origin?.isConnected)origin.focus();
 }
 cancel.onclick=close;
 modal.querySelector('[data-close]').onclick=close;
 root.onclick=event=>{if(event.target===root)close();};
 modal.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();close();}};
 list.onclick=event=>{
  const button=event.target.closest('[data-lease-rate-year]');
  if(!button)return;
  year.value=button.dataset.leaseRateYear;fill();value.focus();
 };
 year.onchange=fill;
 save.onclick=async()=>{
  if(busy)return;
  error.hidden=true;
  const controls=[...modal.querySelectorAll('button,input')];
  try{
   const id=yearId(),next=leaseEngine224.rate(value.value);
   if(next===null)throw Error('請輸入郵政年利率，零利率請填 0');
   busy=true;controls.forEach(control=>control.disabled=true);
   await commitLeaseRate224(id,next,initialRows.get(id));
   initialRows.set(id,{id,rate:next});renderRates();
   state.leaseRates=await getAll('leaseRates');
   renderContracts220();
   toast('年度郵政利率已儲存');
  }catch(failure){error.textContent=failure.message;error.hidden=false;}
  finally{busy=false;controls.forEach(control=>control.disabled=false);}
 };
 renderRates();fill();year.focus();
}
function leaseNotice224(contract,period,mode){
 const name=clientById(contract.clientId)?.name||'';
 const basis=contract.lease.rentBasis==='net'?'未稅':'含稅';
 const lines=[];
 const includeMissing=mode==='issues'||mode==='missing';
 const annualRate=period.annual===null?'':`，郵政年利率 ${leaseEngine224.format(period.annual,4)}%`;
 if(period.hasMonthlyRent){
  for(const row of period.rentRows){
   const month=rentMonthLabel234(row),basis=rentBasisLabel234(row.basis);
   if(includeMissing&&row.result==='missing'){
    lines.push(`${month} 租金發票尚未開立${row.expected===null?'。':`，應開${basis}金額為 ${leaseMoney224(row.expected)}。`}`);
   }
   if((mode==='issues'||mode==='rent')&&row.result==='different'){
    lines.push(`${month} 租金${basis}金額有差異，依約應開 ${leaseMoney224(row.expected)}，實際開立 ${leaseMoney224(row.actual)}。`);
   }
  }
 }
 if(!period.hasMonthlyRent&&includeMissing&&period.rentResult==='missing'){
  lines.push('租金發票尚未開立'+(period.rent===null?'。':`，應開${basis}金額為 ${leaseMoney224(period.rent)}。`));
 }
 if(!period.hasMonthlyRent&&(mode==='issues'||mode==='rent')&&period.rentResult==='different'){
  lines.push(`租金${basis}金額有差異，依約應開 ${leaseMoney224(period.rent)}，實際開立 ${leaseMoney224(period.check.rentActual)}。`);
 }
 if(period.hasMonthlyInterest||!period.hasLegacyInterest){
  for(const row of period.interestRows){
   const month=rentMonthLabel234(row);
   if(includeMissing&&row.result==='missing'){
    lines.push(`${month} 押金設算利息尚未開立${row.interest===null?'。':`，應列銷售額為 ${leaseMoney224(row.interest)}。`}`);
   }
   if((mode==='interest'&&row.interest!==null&&row.interest>0)||(mode==='issues'&&row.result==='different')){
    const actual=row.actual===null?'':`，實際列示 ${leaseMoney224(row.actual)}`;
    lines.push(`${month} 押金設算利息銷售額為 ${leaseMoney224(row.interest)}${annualRate}${actual}。`);
   }
  }
 }else{
  if(includeMissing&&period.interestResult==='missing'){
   lines.push('押金設算利息尚未開立'+(period.interest===null?'。':`，應列銷售額為 ${leaseMoney224(period.interest)}。`));
  }
  if((mode==='interest'&&period.interest!==null&&period.interest>0)||(mode==='issues'&&period.interestResult==='different')){
   const annual=annualRate?`${annualRate}，計 ${period.interestMonths} 個月`:'';
   const actual=period.check.interestActual===null?'':`，實際列示 ${leaseMoney224(period.check.interestActual)}`;
   lines.push(`押金設算利息銷售額為 ${leaseMoney224(period.interest)}${annual}${actual}。`);
  }
 }
 if(!lines.length)return '';
 return [name?name+' 您好：':'您好：',`關於「${contract.title}」${leaseRange224(period)} 的租賃發票，想請您協助核對以下項目：`,
  ...lines.map((line,index)=>`${index+1}. ${line}`),'','煩請確認後回覆，謝謝。'].join('\n');
}

const contractTabs228=[['basic','基本資料'],['setup','每月租金'],['deposit','押金紀錄'],['review','逐期核對'],['notice','通知紀錄']];
const leaseNoticeModes228={issues:'全部已確認異常',missing:'漏開發票',rent:'租金金額差異',interest:'押金設算利息'};
const leaseInvoiceStatuses235=[['pending','待核對'],['issued','已開立'],['missing','未開立']];
const leaseField228=(id,label,type,properties='')=>`<label class="field" for="${id}">${label}<input id="${id}" class="input" type="${type}" ${properties}></label>`;
function contractLeasePanels228(contract,basic,{recoveredRent=false}={}){
 const lease=contract.lease||leaseEngine224.defaultLease(),field=leaseField228;
 const panel=(key,html)=>`<section id="lease-pane-${key}" class="lease-pane224" role="tabpanel" aria-labelledby="lease-tab-${key}" ${key==='basic'?'':'hidden'}>${html}</section>`;
 return `<div class="lease-workspace224">
  <p class="contract-manager-context228" id="contractManagerContext228"></p>
  <nav class="lease-tabs224" role="tablist" aria-label="合約管理">${contractTabs228.map(([id,title])=>
   `<button class="btn" type="button" role="tab" data-lease-tab="${id}" id="lease-tab-${id}" aria-controls="lease-pane-${id}" aria-selected="${id==='basic'}" tabindex="${id==='basic'?0:-1}">${title}</button>`).join('')}</nav>
  <div id="leaseError224" class="notice warn" role="alert" tabindex="-1" hidden></div>
  ${panel('basic',`${basic}
   <div class="lease-review-settings231" data-company-lease238>
    <label class="field">發票核對週期<select id="leaseFrequency224" class="select">${leaseEngine224.frequencies.map(key=>leaseOption224(key,leaseFrequency224[key],lease.frequency)).join('')}</select></label>
   </div>`)}
  ${panel('setup',`
   <div class="lease-rent-settings231" data-company-lease238>
    <label class="field">月租金額基準<select id="leaseRentBasis224" class="select">${[['net','未稅'],['gross','含稅']].map(([key,label])=>leaseOption224(key,label,lease.rentBasis)).join('')}</select></label>
    ${field('leaseRentVatRate234','租金稅率（%）','text','inputmode="decimal" value="'+esc(leaseEngine224.format(lease.rentVatRate??leaseEngine224.defaultRentTaxRate,4))+'"')}
   </div>
   <section class="lease-section224">
    <header><h3>月租與調租</h3><button class="btn" type="button" id="leaseAddStep224">新增調租階段</button></header>
    ${recoveredRent?'<p class="contract-renew-info221" id="leaseRecoveredRent237">首段月租已從上期最後一段帶入，可修改後儲存。</p>':''}
    <div id="leaseSteps224"></div>
   </section>
  `)}
  ${panel('deposit',`
   <section class="lease-deposit231" aria-labelledby="leaseDepositTitle231">
    <h3 id="leaseDepositTitle231">押金與設算利息</h3>
    <p data-company-lease238>押金本金用於計算設算利息。無押金請填 0。</p>
    <p id="leaseDepositPersonal238" hidden>押金本金與給付核對分開登記。</p>
    <div class="lease-fields224">
     ${field('leaseDeposit224','押金本金（元）','text','inputmode="decimal" placeholder="待填"')}
     <label class="field" data-company-lease238>設算利息方式<select id="leaseRegime224" class="select">${[['invoice','一般稅額'],['assessed','查定計算']].map(([key,label])=>leaseOption224(key,label,lease.regime)).join('')}</select></label>
     ${field('leaseVAT224','營業稅徵收率（%）','text','inputmode="decimal"')}
    </div>
   </section>
   <section class="lease-interest-preview232" aria-labelledby="leaseInterestTitle232" data-company-lease238>
    <header><h3 id="leaseInterestTitle232">每月設算利息</h3>
     <label class="field">試算年度<select class="select" id="leaseInterestYear232"></select></label>
    </header>
    <dl><div><dt>設算利息</dt><dd id="leaseMonthlyGross232">—</dd></div>
     <div><dt>應列銷售額</dt><dd id="leaseMonthlySales232">—</dd></div></dl>
    <p id="leaseMonthlyHint232" role="status"></p>
    <div class="lease-rate-quick224" id="leasePreviewRate232" hidden>
     ${field('leaseRateInput232','該年 1 月 1 日郵政一年期固定利率（%）','text','inputmode="decimal"')}
     <button class="btn" type="button" id="leaseSavePreviewRate232">儲存年度利率</button>
    </div>
   </section>
   <details class="lease-section224 lease-post224" data-company-lease238><summary>年度郵政利率</summary><div id="leaseRateChips224"></div></details>
  `)}
  ${panel('review',`
   ${individualLeaseReview238()}
   <div id="leaseReviewEmpty228" class="empty" hidden>請先在基本資料填寫有效的租期起訖日。</div>
   <div class="lease-review-layout224" id="leaseReviewLayout228">
    <div class="lease-period-pane224">
     <label class="field">核對年度<select class="select" id="leaseYear224"></select></label>
     <div id="leasePeriods224" class="lease-periods224"></div>
    </div>
    <section id="leaseCheck224" class="lease-check224"></section>
   </div>
  `)}
  ${panel('notice',`
   <div id="leaseNoticeDraft228" hidden>
    <div class="lease-notice-head224">
     <label class="field">核對期間<select id="leaseNoticeRange228" class="select"></select></label>
     <strong id="leaseNoticePeriod224" hidden></strong>
     <label class="field">通知內容<select class="select" id="leaseNoticeMode224">${Object.entries(leaseNoticeModes228).map(([key,label])=>leaseOption224(key,label,'issues')).join('')}</select></label>
    </div>
    <label class="field">訊息預覽<textarea class="textarea" id="leaseNoticeText224" rows="6" maxlength="12000"></textarea></label>
    <div class="lease-notice-actions224"><button class="btn" type="button" id="leaseRegenerate224">重新帶入</button><button class="btn" type="button" id="leaseCopy224">複製通知</button><button class="btn" type="button" id="leaseRecordNotice228">存入紀錄</button></div>
   </div>
   <section class="lease-section224 lease-history228"><header><h3>已留存通知</h3></header><div id="leaseHistory228"></div></section>
  `)}
 </div>`;
}
function mountContractLease228(modal,baseline,readBasic,recordNotice){
 let term={...baseline},draft=baseline.lease?leaseEngine224.normalize(baseline.lease,baseline.startDate,baseline.endDate):leaseEngine224.defaultLease();
 const error=$('#leaseError224'),field=leaseField228;
 const paymentReview=mountIndividualLease238(baseline);
 const personal=()=>readBasic().rental.kind==='individual';
 function syncMode(){
  const individual=personal();
  modal.querySelectorAll('[data-company-lease238]').forEach(node=>node.hidden=individual);
  $('#leaseDepositTitle231').textContent=individual?'押金紀錄':'押金與設算利息';
  $('#leaseDepositPersonal238').hidden=!individual;
  $('#lease-tab-review').textContent=individual?'扣繳核對':'逐期核對';
  showRegime();
 }
 const steps=$('#leaseSteps224'),years=$('#leaseYear224'),list=$('#leasePeriods224'),checkPanel=$('#leaseCheck224');
 const interestYear=$('#leaseInterestYear232'),previewRate=$('#leaseRateInput232');
 const notices=new Map(),noticeMode=$('#leaseNoticeMode224'),noticeText=$('#leaseNoticeText224'),copy=$('#leaseCopy224');
 let pane='basic',periods=[],selectedKey='',noticeKey='',busy=false,checkMounted=false;
 let rentDisplay=draft.rentBasis,rentDisplayPicked=false;
 const monthScope={rent:'period',interest:'period'};
 const selectedMonths={rent:new Set(),interest:new Set()};
 const val=id=>$('#'+id).value;
 const format=leaseEngine224.format;
 $('#leaseDeposit224').value=format(draft.deposit);
 $('#leaseVAT224').value=format(draft.vatRate,4);

 function appendStep(from='',cents=null,opening=false,remindDays=leaseEngine224.defaultRentReminderDays){
  steps.insertAdjacentHTML('beforeend',`<div class="lease-step224">
   <label class="field">生效日<input class="input lease-step-date" type="date" min="${esc(term.startDate)}" max="${esc(term.endDate)}" value="${esc(from)}" ${opening?'readonly':''}></label>
   <label class="field">${opening?'首段月租（元）':'月租（元）'}<input class="input lease-step-rent" inputmode="decimal" value="${esc(format(cents))}"></label>
   ${opening?'':`<button class="btn danger" type="button" data-lease-remove-step>移除</button>
   <div class="lease-step-reminder233">
    <label class="cases-check219"><input type="checkbox" data-rent-reminder-toggle233 ${remindDays===null?'':'checked'}>提醒調租</label>
    <label class="field" ${remindDays===null?'hidden':''}>提前天數<input class="input" data-rent-reminder-days233 type="number" inputmode="numeric" min="0" max="365" step="1"
     value="${esc(remindDays??leaseEngine224.defaultRentReminderDays)}"></label>
   </div>`}</div>`);
 }
 appendStep(baseline.startDate,draft.steps[0]?.cents??null,true);
 draft.steps.slice(1).forEach(step=>appendStep(step.from,step.cents,false,step.remindDays));
 $('#leaseAddStep224').onclick=()=>{
  if(steps.childElementCount>=120){toast('租金階段最多 120 筆');return;}
  appendStep();
  steps.lastElementChild.querySelector('.lease-step-rent').focus();
 };
 steps.onclick=event=>{const remove=event.target.closest('[data-lease-remove-step]');if(remove){remove.closest('.lease-step224').remove();$('#leaseAddStep224').focus();}};
 steps.onchange=event=>{
  if(event.target.matches('[data-rent-reminder-toggle233]')){
   event.target.closest('.lease-step-reminder233').querySelector('[data-rent-reminder-days233]').closest('label').hidden=!event.target.checked;
  }
 };
 const showRegime=()=>{$('#leaseVAT224').closest('label').hidden=personal()||val('leaseRegime224')==='assessed';};
 $('#leaseRegime224').onchange=()=>{showRegime();drawMonthlyInterest();};
 for(const id of ['leaseDeposit224','leaseVAT224'])$('#'+id).oninput=drawMonthlyInterest;
 interestYear.onchange=()=>{previewRate.value='';drawMonthlyInterest();};
 $('#leaseSavePreviewRate232').onclick=async()=>{
  if(busy||!interestYear.value)return;
  const year=interestYear.value;
  const controls=[...modal.querySelectorAll('input,select,textarea,button')].filter(control=>!control.disabled);
  let saved=false;
  error.hidden=true;
  try{
   const rate=leaseEngine224.rate(previewRate.value);
   if(rate===null)throw Error('請填寫本年度利率');
   busy=true;
   controls.forEach(control=>control.disabled=true);
   await commitLeaseRate224(year,rate,undefined);
   state.leaseRates=await getAll('leaseRates');
   renderContracts220();
   drawRateChips();
   previewRate.value='';
   saved=true;
   toast('年度郵政利率已儲存');
  }catch(failure){
   error.textContent=failure.message;
   error.hidden=false;
   error.focus();
  }finally{
   busy=false;
   controls.forEach(control=>control.disabled=false);
   interestYear.disabled=!interestYear.value;
   if(saved)interestYear.focus({preventScroll:true});
  }
 };
 showRegime();
 function setupSnapshot(){
  return [val('leaseFrequency224'),val('leaseRentBasis224'),val('leaseRentVatRate234'),val('leaseDeposit224'),val('leaseRegime224'),val('leaseVAT224'),
   [...steps.querySelectorAll('input:not([readonly])')].map(input=>input.type==='checkbox'?input.checked:input.value)];
 }
 const costsSnapshot=()=>JSON.stringify([setupSnapshot(),draft.checks,draft.rentMonths||[],draft.interestChecks||[]]);
 const snapshot=()=>JSON.stringify([costsSnapshot(),paymentReview.snapshot()]);
 const hasUnsaved=()=>{
  if(checkMounted){
   try{collectCheck();}catch{return true;}
  }
  return snapshot()!==initial;
 };
 let initial=snapshot();
 let initialCosts=costsSnapshot();
 function updateTerm(){
  term={...term,...readBasic()};
  const inputs=[...steps.querySelectorAll('.lease-step-date')];
  inputs[0].value=term.startDate;
  for(const input of inputs){input.min=term.startDate;input.max=term.endDate;}
 }
 function validTerm(){
  const valid=createCasesEngine219().date;
  return valid(term.startDate)&&valid(term.endDate)&&term.startDate<=term.endDate;
 }
 function collectCheck(){
  if(!checkMounted)return;
  const months=$('#leaseInterestMonths224')?.value||'';
  const row={key:selectedKey,interestMonths:months===''?null:Number(months)};
  for(const part of ['rent','interest']){
   if(!$('#lease-'+part+'-status224')){
    row[part+'Status']='pending';row[part+'Actual']=null;continue;
   }
   const status=val('lease-'+part+'-status224');
   row[part+'Status']=status;
   row[part+'Actual']=status==='issued'?leaseEngine224.amount(val('lease-'+part+'-actual224')):null;
  }
  const entries=new Map((draft.rentMonths||[]).map(entry=>[entry.key,entry]));
  const inputs=checkPanel.querySelectorAll('[data-rent-actual234]');
  for(const input of inputs){
   if(input.value===input.defaultValue)continue;
   const key=input.dataset.rentActual234,actual=leaseEngine224.amount(input.value);
   const saved=entries.get(key);
   if(saved&&actual===projectRent(saved.actual,saved.basis))continue;
   if(actual===null)entries.delete(key);
   else entries.set(key,{key,actual,basis:rentDisplay,status:'issued'});
  }
  const interestChecks=new Map((draft.interestChecks||[]).map(entry=>[entry.key,entry]));
  for(const row of checkPanel.querySelectorAll('[data-interest-row235]')){
   const key=row.dataset.interestRow235,charged=row.querySelector('[data-interest-charge235]').checked;
   const status=row.querySelector('[data-interest-status235]').value;
   const actual=status==='issued'?leaseEngine224.amount(row.querySelector('[data-interest-actual235]').value):null;
   interestChecks.set(key,{key,charged,status,actual});
  }
  const normalized=leaseEngine224.normalize({...draft,rentMonths:[...entries.values()],interestChecks:[...interestChecks.values()],
   checks:[...draft.checks.filter(row=>row.key!==selectedKey),row]},term.startDate,term.endDate);
  draft.checks=normalized.checks.sort((a,b)=>a.key.localeCompare(b.key));
  draft.rentMonths=normalized.rentMonths||[];
  draft.interestChecks=normalized.interestChecks||[];
  for(const input of inputs)input.defaultValue=input.value;
 }
 function collect(){
  collectCheck();
  updateTerm();
  const rentBasis=val('leaseRentBasis224');
  if(rentBasis!==draft.rentBasis&&leaseEngine224.hasRentActual(draft)){
   throw Error('已有實開租金金額，請先清除相關核對金額再變更合約的租金基準');
  }
  const rentVatRate=leaseEngine224.rate(val('leaseRentVatRate234'));
  if(rentVatRate===null)throw Error('請填寫租金稅率');
  const vatRate=leaseEngine224.rate(val('leaseVAT224'));
  if(val('leaseRegime224')==='invoice'&&vatRate===null)throw Error('請填寫營業稅徵收率');
  const newSteps=[...steps.querySelectorAll('.lease-step224')].map(row=>{
   const toggle=row.querySelector('[data-rent-reminder-toggle233]');
   return {from:row.querySelector('.lease-step-date').value,cents:leaseEngine224.amount(row.querySelector('.lease-step-rent').value),
    ...(toggle?{remindDays:toggle.checked?leaseEngine224.rentReminderDays(row.querySelector('[data-rent-reminder-days233]').value):null}:{})};
  });
  if(newSteps[0].cents===null){
   if(newSteps.length>1){
    activate('setup');
    throw Error('請先填寫首段月租，再儲存後續調租。');
   }
   newSteps.pop();
  }
  const costs=leaseEngine224.updateDeposit(draft,term.startDate,val('leaseDeposit224'));
  draft=leaseEngine224.normalize({...costs,frequency:Number(val('leaseFrequency224')),rentBasis,rentVatRate,
   regime:val('leaseRegime224'),vatRate:vatRate??draft.vatRate,steps:newSteps},term.startDate,term.endDate);
  periods=leaseEngine224.calculate({...term,lease:draft},leaseRates224());
  if(!rentDisplayPicked)rentDisplay=rentBasis;
 }
 function attempt(action){
  if(busy)return;
  error.hidden=true;
  try{action();}catch(failure){
   if(failure.field==='deposit')activate('deposit');
   error.textContent=failure.message;error.hidden=false;error.focus();
  }
 }
 function drawRateChips(){
  const target=$('#leaseRateChips224');
  target.parentElement.hidden=!validTerm();
  const start=Number(term.startDate.slice(0,4)),end=Number(term.endDate.slice(0,4)),prior=interestYear.value;
  const all=validTerm()?Array.from({length:Math.min(101,end-start+1)},(_,i)=>String(start+i).padStart(4,'0')):[];
  const current=localDate().slice(0,4),preferred=all.includes(prior)?prior:current<all[0]?all[0]:current>all.at(-1)?all.at(-1):current;
  interestYear.innerHTML=all.map(year=>leaseOption224(year,leaseYear224(year),preferred)).join('');
  interestYear.disabled=!all.length;
  if(interestYear.value!==prior)previewRate.value='';
  const rows=new Map(leaseRates224().map(rate=>[rate.id,rate.rate]));
  target.innerHTML=all.map(year=>`<span class="lease-rate-chip224">${esc(leaseYear224(year))} ${rows.has(year)?'<strong>'+esc(format(rows.get(year),4))+'%</strong>':'<span>未設定</span>'}</span>`).join('');
  drawMonthlyInterest();
 }
 function drawMonthlyInterest(){
  const year=interestYear.value,annual=leaseRates224().find(row=>row.id===year)?.rate??null;
  const hint=$('#leaseMonthlyHint232'),grossLabel=$('#leaseMonthlyGross232'),salesLabel=$('#leaseMonthlySales232');
  const missingRate=$('#leasePreviewRate232');
  grossLabel.textContent=salesLabel.textContent='—';
  missingRate.hidden=true;
  hint.textContent='請先填寫有效的租期起訖日。';
  if(!year)return;
  let deposit,vatRate;
  const regime=val('leaseRegime224');
  try{deposit=leaseEngine224.amount(val('leaseDeposit224'));}
  catch{hint.textContent='請核對押金本金格式。';return;}
  if(deposit===null){hint.textContent='填寫押金本金後即可試算。';return;}
  const raw=leaseEngine224.monthlyInterestAmounts({deposit,annual,regime:'assessed'});
  if(raw.needsRate){
   hint.textContent=leaseYear224(year)+'尚未設定郵政利率。儲存後套用至同年度租約。';
   missingRate.hidden=false;
   return;
  }
  grossLabel.textContent=leaseMoney224(raw.gross);
  if(regime==='invoice'&&deposit>0){
   try{vatRate=leaseEngine224.rate(val('leaseVAT224'));}
   catch{hint.textContent='請核對營業稅徵收率。';return;}
   if(vatRate===null){hint.textContent='請填寫營業稅徵收率。';return;}
  }
  salesLabel.textContent=leaseMoney224(leaseEngine224.monthlyInterestAmounts({deposit,annual,regime,vatRate:vatRate??0}).interest);
  hint.textContent=annual===null?'押金本金為 0。':'郵政年利率 '+format(annual,4)+'%。逐期金額可在「逐期核對」查看。';
 }
 function activate(next){
  pane=next;
  if(next!=='review')checkMounted=false;
  if(next==='deposit')drawRateChips();
  for(const [key] of contractTabs228){
   const tab=$('#lease-tab-'+key),active=key===pane;
   tab.setAttribute('aria-selected',String(active));
   tab.tabIndex=active?0:-1;
   $('#lease-pane-'+key).hidden=!active;
  }
  modal.querySelector('.modal-body').scrollTop=0;
  revealLease224($('#lease-pane-'+pane));
 }
 function ensurePeriod(preferredYear){
  const yearIds=[...new Set(periods.map(period=>period.year))];
  const selected=periods.find(period=>period.key===selectedKey);
  const year=yearIds.includes(preferredYear)?preferredYear:selected?.year||yearIds.find(key=>key===localDate().slice(0,4))||yearIds[0];
  const yearPeriods=periods.filter(period=>period.year===year);
  selectedKey=(yearPeriods.find(period=>period.key===selectedKey)||yearPeriods[0]).key;
  years.innerHTML=yearIds.map(option=>leaseOption224(option,leaseYear224(option),year)).join('');
 }
 function drawPeriods(){
  list.innerHTML=periods.filter(period=>period.year===years.value).map(period=>`<button class="lease-period224" type="button" data-lease-period="${esc(period.key)}" aria-pressed="${period.key===selectedKey}"><strong>${esc(leaseRange224(period))}</strong>${leaseOutcomeBadge224(leasePeriodStatus224(period))}</button>`).join('');
 }
 function metric(period,part,label,basis){
  const expected=period[part],actual=period.check[part+'Actual'],status=period.check[part+'Status'];
  const metricKey='legacy-'+part;
  return `<section class="lease-metric224">
    <header><h3>${label}</h3><span data-lease-outcome="${metricKey}">${leaseOutcomeBadge224(part==='rent'?period.legacyRentResult:period.legacyInterestResult)}</span></header>
    <dl><div><dt>應開・${basis}</dt><dd data-lease-expected="${metricKey}">${esc(leaseMoney224(expected))}</dd></div>
    <div><dt>差額・實開減應開</dt><dd data-lease-delta="${metricKey}">${expected!==null&&actual!==null?esc(leaseMoney224(actual-expected)):'—'}</dd></div></dl>
    <div class="lease-fields224">
     <label class="field">發票狀態<select class="select" id="lease-${part}-status224">${leaseInvoiceStatuses235.map(([key,title])=>leaseOption224(key,title,status)).join('')}</select></label>
     <label class="field" id="lease-${part}-field224" ${status==='issued'?'':'hidden'}>實開・${basis}<input class="input" id="lease-${part}-actual224" inputmode="decimal" value="${esc(format(actual))}"></label>
    </div>
    ${part==='interest'?field('leaseInterestMonths224','整期計息月數','number',`min="0" max="${period.months.length}" step="1" placeholder="${period.fullMonths}" value="${esc(period.check.interestMonths??'')}"`):''}
   </section>`;
 }
 const interestDelta=row=>row.actual===null||row.interest===null?'—':leaseMoney224(row.actual-row.interest);
 const interestOutcome=row=>!row.charged&&row.status==='pending'?statusBadge('不計息','gray'):leaseOutcomeBadge224(row.result);
 function reviewPeriods(part,period){
  return monthScope[part]==='year'?periods.filter(row=>row.year===period.year):[period];
 }
 function reviewRows(part,period){
  return reviewPeriods(part,period).flatMap(row=>part==='rent'?row.rentRows:row.interestRows);
 }
 function monthlyScopeField(part,id){
  return `<label class="field">核對月份<select class="select" id="${id}" data-month-scope236="${part}">${[['period','本期'],['year','本年度']]
   .map(([key,label])=>leaseOption224(key,label,monthScope[part])).join('')}</select></label>`;
 }
 function monthlyBatchControls(part){
  const prefix=part==='rent'?'leaseRent':'leaseInterest',suffix=part==='rent'?'234':'236';
  return `<div class="lease-rent-actions234">
   <label class="cases-check219"><input type="checkbox" id="${prefix}SelectAll${suffix}" data-month-all236>全選月份</label>
   <p id="${prefix}Selected${suffix}" data-month-selected236 role="status"></p>
   <button type="button" class="btn primary" data-${part}-batch${suffix}="match">核對勾選</button>
   <button type="button" class="btn" data-${part}-batch${suffix}="missing">標記未開</button>
   <button type="button" class="btn ghost" data-${part}-batch${suffix}="clear">清除核對</button>
  </div>`;
 }
 function monthlySelect(part,row){
  const label=part==='rent'?'租金':'押息',suffix=part==='rent'?'234':'236';
  const available=part==='rent'||row.charged;
  return `<label class="lease-rent-select234"><input type="checkbox" data-month-key236 data-${part}-select${suffix}="${esc(row.key)}"
    value="${esc(row.key)}" aria-label="勾選${label} ${esc(rentMonthLabel234(row))}" ${available?'':'disabled title="此月不計息"'}></label>`;
 }
 function interestReviewTotals(period){
  const active=reviewPeriods('interest',period);
  const total=active.some(row=>row.interestSalesTotal===null)?null:active.reduce((sum,row)=>sum+row.interestSalesTotal,0);
  const outcome=['missing','different','unknown','pending'].find(key=>active.some(row=>row.interestResult===key))||'matched';
  return {total,outcome,needsRate:active.some(interestRateNeeded235)};
 }
 function monthlyInterestTable(period){
  const rows=reviewRows('interest',period),summary=interestReviewTotals(period);
  return `<section class="lease-metric224 lease-interest-review235" data-month-review236="interest" aria-labelledby="leaseInterestReview235">
   <header><div><h3 id="leaseInterestReview235" tabindex="-1">逐月押金設算利息核對</h3>
    <div class="lease-rent-total234">${monthScope.interest==='year'?'本年度':'本期'}應列銷售額合計 <strong data-lease-expected="interest">${esc(leaseMoney224(summary.total))}</strong></div></div>
    <div class="lease-rent-options234"><span data-lease-outcome="interest">${leaseOutcomeBadge224(summary.outcome)}</span>
     ${monthlyScopeField('interest','leaseInterestScope236')}</div></header>
   <div class="lease-interest-source235"><span>押金本金 <strong data-lease-deposit>${esc(leaseMoney224(draft.deposit))}</strong></span>
    <span>${esc(leaseYear224(period.year))}郵政利率 <strong>${period.annual===null?'未設定':esc(format(period.annual,4))+'%'}</strong></span></div>
   ${summary.needsRate?`<div class="lease-rate-quick224">
    ${field('leaseQuickRate224',leaseYear224(period.year)+'郵政固定利率（%）','text','inputmode="decimal"')}
    <button class="btn" type="button" id="leaseSaveQuickRate224">儲存利率</button></div>`:''}
   ${monthlyBatchControls('interest')}
   <p class="lease-rent-note234">已填金額按實開核對。空白帶入應列銷售額，略過不計息月份。</p>
   <div class="lease-interest-rows235">${rows.map(row=>{
    const month=rentMonthLabel234(row);
    return `<div class="lease-interest-row235" data-interest-row235="${esc(row.key)}">
     ${monthlySelect('interest',row)}
     <div class="lease-interest-month235"><strong>${esc(month)}</strong>
      <label class="cases-check219"><input type="checkbox" aria-label="${esc(month)} 計息" data-interest-charge235 ${row.charged?'checked':''}>計息</label></div>
     <dl><div><dt>設算利息</dt><dd data-interest-gross235>${esc(leaseMoney224(row.gross))}</dd></div>
      <div><dt>應列銷售額</dt><dd data-interest-sales235>${esc(leaseMoney224(row.interest))}</dd></div></dl>
     <label class="field lease-interest-status236">發票狀態<select class="select" data-interest-status235 aria-label="${esc(month)} 押息發票狀態">${leaseInvoiceStatuses235.map(([key,label])=>leaseOption224(key,label,row.status)).join('')}</select></label>
     <label class="field" data-interest-actual-field235 ${row.status==='issued'?'':'hidden'}>實開銷售額<input class="input" inputmode="decimal" data-interest-actual235 aria-label="${esc(month)} 押息實開銷售額" value="${esc(format(row.actual))}"></label>
     <div class="lease-interest-result235"><span data-interest-result235>${interestOutcome(row)}</span><small data-interest-delta235>${esc(interestDelta(row))}</small></div>
    </div>`;
   }).join('')}</div>
  </section>`;
 }
 const projectRent=(cents,basis)=>leaseEngine224.convertRent(cents,basis,rentDisplay,draft.rentVatRate);
 function recordedRent(row){
  return row.actual!==null&&row.basis!==rentDisplay?'原錄'+rentBasisLabel234(row.basis)+' '+leaseMoney224(row.actual):'';
 }
 function rentDelta(row){
  return row.actual===null||row.expected===null?'—':leaseMoney224(projectRent(row.actual-row.expected,row.basis));
 }
 function rentTotal(rows){
  return rows.every(row=>row.base===null)?null:rows.reduce((sum,row)=>sum+(projectRent(row.base,draft.rentBasis)??0),0);
 }
 function monthlyRentTable(period){
  const rows=reviewRows('rent',period),basis=rentBasisLabel234(rentDisplay);
  return `<section class="lease-metric224 lease-rent-review234" data-month-review236="rent" aria-labelledby="leaseRentReviewTitle234">
   <header><div><h3 id="leaseRentReviewTitle234">逐月租金核對</h3><div class="lease-rent-total234">
    ${monthScope.rent==='year'?'本年度':'本期'}應開・${basis} <strong data-lease-expected="rent">${esc(leaseMoney224(rentTotal(rows)))}</strong></div></div>
    <div class="lease-rent-options234">
     <label class="field">顯示與輸入<select class="select" id="leaseRentDisplay234">${[['net','未稅'],['gross','含稅']].map(([key,label])=>leaseOption224(key,label,rentDisplay)).join('')}</select></label>
     ${monthlyScopeField('rent','leaseRentScope234')}
    </div>
   </header>
   ${monthlyBatchControls('rent')}
   <p class="lease-rent-note234">已填金額按實開核對，空白會帶入應開金額。</p>
   <div class="lease-rent-table234">
    <div class="lease-rent-row234 lease-rent-head234" aria-hidden="true"><span></span><span>月份</span><span>應開・${basis}</span><span>實開・${basis}</span><span>差額／結果</span></div>
    ${rows.map(row=>{
     const month=rentMonthLabel234(row);
     return `<div class="lease-rent-row234" data-rent-row234="${esc(row.key)}">
      ${monthlySelect('rent',row)}
      <strong class="lease-rent-month234">${esc(month)}</strong>
      <div class="lease-rent-expected234"><small>應開・${basis}</small><strong>${esc(leaseMoney224(projectRent(row.base,draft.rentBasis)))}</strong></div>
      <label class="lease-rent-actual234"><small>實開・${basis}</small>
       <input class="input" inputmode="decimal" data-rent-actual234="${esc(row.key)}" aria-label="${esc(month)} 實開${basis}" value="${esc(format(projectRent(row.actual,row.basis)))}">
       <span data-rent-recorded234>${esc(recordedRent(row))}</span>
      </label>
      <div class="lease-rent-result234"><span data-rent-result234>${leaseOutcomeBadge224(row.result)}</span><small data-rent-delta234>${esc(rentDelta(row))}</small></div>
     </div>`;
    }).join('')}
   </div>
  </section>`;
 }
 const monthBatchSelector='[data-rent-batch234],[data-interest-batch236]';
 function updateMonthSelection(root){
  const part=root.dataset.monthReview236,selected=selectedMonths[part];
  const boxes=[...root.querySelectorAll('[data-month-key236]')],eligible=boxes.filter(box=>!box.disabled);
  const keys=new Set(eligible.map(box=>box.value));
  for(const key of selected)if(!keys.has(key))selected.delete(key);
  for(const box of boxes)box.checked=selected.has(box.value);
  const selectAll=root.querySelector('[data-month-all236]'),count=selected.size;
  selectAll.disabled=!eligible.length;
  selectAll.checked=count>0&&count===eligible.length;
  selectAll.indeterminate=count>0&&count<eligible.length;
  root.querySelector('[data-month-selected236]').textContent=eligible.length?'已選 '+count+' 月':'無計息月份可勾選';
  root.querySelectorAll(monthBatchSelector).forEach(button=>button.disabled=!count);
 }
 checkPanel.addEventListener('click',event=>{
  const button=event.target.closest(monthBatchSelector);
  if(!button)return;
  const part=button.closest('[data-month-review236]').dataset.monthReview236,selected=selectedMonths[part];
  const isRent=part==='rent',kind=button.dataset.rentBatch234||button.dataset.interestBatch236;
  if(!selected.size)return;
  attempt(()=>{
   collect();
   const period=periods.find(row=>row.key===selectedKey);
   const rows=reviewRows(part,period).filter(row=>selected.has(row.key)&&(isRent||row.charged));
   if(!rows.length)return;
   if(kind==='match'){
    if(isRent&&rows.some(row=>row.actual===null&&row.base===null))throw Error('有勾選月份尚未設定租金，請先補填實開或月租。');
    if(!isRent&&rows.some(row=>row.interest===null))throw Error('有勾選月份尚未算出押息，請先確認押金本金與年度郵政利率。');
   }
   if(kind!=='match'&&rows.some(row=>row.actual!==null)&&
    !window.confirm(kind==='clear'?'清除勾選月份的核對狀態與實開金額？':'標記未開會清除勾選月份已填的實開金額。繼續？'))return;
   const field=isRent?'rentMonths':'interestChecks';
   const entries=new Map((draft[field]||[]).map(entry=>[entry.key,entry]));
   for(const row of rows){
    const key=row.key;
    if(kind==='match'&&row.actual!==null)continue;
    if(kind==='clear'&&isRent){entries.delete(key);continue;}
    const status={clear:'pending',missing:'missing',match:'issued'}[kind];
    const actual=kind==='match'?(isRent?row.base:row.interest):null;
    const details=isRent?{basis:kind==='match'?draft.rentBasis:rentDisplay}:{charged:row.charged};
    entries.set(key,{key,status,actual,...details});
   }
   draft=leaseEngine224.normalize({...draft,[field]:[...entries.values()]},term.startDate,term.endDate);
   periods=leaseEngine224.calculate({...term,lease:draft},leaseRates224());
   selected.clear();
   drawPeriods();drawCheck();
   checkPanel.querySelector(`[data-month-review236="${part}"] [data-month-all236]`).focus({preventScroll:true});
   toast(kind==='match'?'已核對 '+rows.length+' 月，請儲存合約':kind==='missing'?'已標記 '+rows.length+' 月未開，請儲存合約':'已清除 '+rows.length+' 月核對，請儲存合約');
  });
 });
 function drawCheck(){
  const period=periods.find(period=>period.key===selectedKey);
  const legacy=period.check.rentStatus!=='pending'||period.check.rentActual!==null;
  checkPanel.innerHTML=`<header class="lease-check-head224"><h3>${esc(leaseRange224(period))}</h3><button class="btn" type="button" id="leaseDraftNotice224">建立通知</button></header>
   ${monthlyRentTable(period)}
   <div class="lease-secondary-review234">${monthlyInterestTable(period)}
    ${period.hasLegacyInterest?`<details class="lease-legacy-rent234"><summary>舊版整期押息核對</summary>
     <p>此為整期紀錄。登記單月後，核對結果與通知依單月資料。</p>${metric(period,'interest','整期押息','銷售額')}</details>`:''}
    ${legacy?`<details class="lease-legacy-rent234"><summary>舊版整期租金核對</summary>
     <p>此為整期紀錄。登記單月後，核對結果與通知依單月資料。</p>${metric(period,'rent','整期租金',rentBasisLabel234(draft.rentBasis))}</details>`:''}
   </div>`;
  checkMounted=true;
  checkPanel.querySelectorAll('[data-month-review236]').forEach(updateMonthSelection);
  $('#leaseDraftNotice224').onclick=()=>attempt(()=>showPane('notice'));
  const quick=$('#leaseSaveQuickRate224');
  if(quick)quick.onclick=async()=>{
   if(busy)return;
   error.hidden=true;
   let controls=[];
   try{
    const rate=leaseEngine224.rate(val('leaseQuickRate224'));
    if(rate===null)throw Error('請填寫本年度利率');
    collect();
    busy=true;
    controls=[...modal.querySelectorAll('input,select,textarea,button')].filter(control=>!control.disabled);
    controls.forEach(control=>control.disabled=true);
    await commitLeaseRate224(period.year,rate,undefined);
    state.leaseRates=await getAll('leaseRates');
    collect();
    drawRateChips();drawPeriods();drawCheck();
    $('#leaseDraftNotice224').focus({preventScroll:true});
    toast('年度郵政利率已儲存');
   }catch(failure){error.textContent=failure.message;error.hidden=false;error.focus();}
   finally{busy=false;controls.forEach(control=>control.disabled=false);}
  };
  revealLease224(checkPanel);
 }
 function refreshCheck(){
  const period=periods.find(period=>period.key===selectedKey);
  for(const part of ['rent','interest']){
   const metricKey='legacy-'+part;
   const output=checkPanel.querySelector(`[data-lease-expected="${metricKey}"]`);
   if(!output)continue;
   const actual=period.check[part+'Actual'],expected=period[part];
   output.textContent=leaseMoney224(expected);
   checkPanel.querySelector(`[data-lease-delta="${metricKey}"]`).textContent=expected!==null&&actual!==null?leaseMoney224(actual-expected):'—';
   checkPanel.querySelector(`[data-lease-outcome="${metricKey}"]`).innerHTML=leaseOutcomeBadge224(part==='rent'?period.legacyRentResult:period.legacyInterestResult);
  }
  const rentRows=new Map(reviewRows('rent',period).map(row=>[row.key,row]));
  for(const element of checkPanel.querySelectorAll('[data-rent-row234]')){
   const row=rentRows.get(element.dataset.rentRow234);
   element.querySelector('[data-rent-result234]').innerHTML=leaseOutcomeBadge224(row.result);
   element.querySelector('[data-rent-delta234]').textContent=rentDelta(row);
   element.querySelector('[data-rent-recorded234]').textContent=recordedRent(row);
  }
  const interestRows=new Map(reviewRows('interest',period).map(row=>[row.key,row]));
  for(const element of checkPanel.querySelectorAll('[data-interest-row235]')){
   const row=interestRows.get(element.dataset.interestRow235);
   element.querySelector('[data-interest-gross235]').textContent=leaseMoney224(row.gross);
   element.querySelector('[data-interest-sales235]').textContent=leaseMoney224(row.interest);
   element.querySelector('[data-interest-result235]').innerHTML=interestOutcome(row);
   element.querySelector('[data-interest-delta235]').textContent=interestDelta(row);
   const box=element.querySelector('[data-month-key236]');
   box.disabled=!row.charged;
   box.title=row.charged?'':'此月不計息';
  }
  const summary=interestReviewTotals(period);
  checkPanel.querySelector('[data-lease-expected="interest"]').textContent=leaseMoney224(summary.total);
  checkPanel.querySelector('[data-lease-outcome="interest"]').innerHTML=leaseOutcomeBadge224(summary.outcome);
  updateMonthSelection(checkPanel.querySelector('[data-month-review236="interest"]'));
  const button=[...list.children].find(button=>button.dataset.leasePeriod===selectedKey);
  if(button)button.querySelector('.badge').outerHTML=leaseOutcomeBadge224(leasePeriodStatus224(period));
 }
 checkPanel.onchange=event=>{
  const target=event.target;
  if(!checkMounted||!target.matches('input,select')||target.id==='leaseQuickRate224')return;
  if(target.matches('[data-month-all236],[data-month-key236]')){
   const root=target.closest('[data-month-review236]'),selected=selectedMonths[root.dataset.monthReview236];
   if(target.matches('[data-month-all236]')){
    selected.clear();
    if(target.checked)for(const box of root.querySelectorAll('[data-month-key236]:enabled'))selected.add(box.value);
   }else{
    if(target.checked)selected.add(target.value);
    else selected.delete(target.value);
   }
   updateMonthSelection(root);return;
  }
  if(target.id==='leaseRentDisplay234'||target.matches('[data-month-scope236]')){
   const isDisplay=target.id==='leaseRentDisplay234',part=target.dataset.monthScope236,value=target.value;
   target.value=isDisplay?rentDisplay:monthScope[part];
   attempt(()=>{
    collect();
    if(isDisplay){rentDisplay=value;rentDisplayPicked=true;}
    else{monthScope[part]=value;selectedMonths[part].clear();}
    drawCheck();
    $('#'+target.id).focus({preventScroll:true});
   });
   return;
  }
  for(const part of ['rent','interest']){
   if(!$('#lease-'+part+'-field224'))continue;
   const visible=val('lease-'+part+'-status224')==='issued';
   $('#lease-'+part+'-field224').hidden=!visible;
  }
  if(target.matches('[data-interest-status235]')){
   target.closest('[data-interest-row235]').querySelector('[data-interest-actual-field235]').hidden=target.value!=='issued';
  }
  attempt(()=>{
   collect();
   const period=periods.find(period=>period.key===selectedKey);
   if(interestReviewTotals(period).needsRate!==!!$('#leaseQuickRate224')){
    drawPeriods();drawCheck();
    $('#leaseInterestReview235').focus({preventScroll:true});
   }else refreshCheck();
  });
 };
 function drawNotice(reset=false){
  const period=periods.find(period=>period.key===selectedKey),mode=noticeMode.value;
  noticeKey=selectedKey+':'+mode;
  if(reset)notices.delete(noticeKey);
  $('#leaseNoticePeriod224').textContent=leaseRange224(period);
  const source=leaseNotice224({...term,lease:draft},period,mode);
  const saved=notices.get(noticeKey);
  if(saved&&saved.source!==source)notices.delete(noticeKey);
  noticeText.dataset.generated=source;
  noticeText.value=notices.get(noticeKey)?.text??source;
  noticeText.placeholder=mode==='interest'?'本期無已試算的押息':'本期無已確認的異常';
  copy.disabled=$('#leaseRecordNotice228').disabled=!noticeText.value.trim();
 }
 function drawHistory(){
  $('#leaseHistory228').innerHTML=(baseline.leaseNotices||[]).slice().reverse().map(row=>`<details class="lease-history-entry228">
   <summary><strong>${esc(leaseNoticeModes228[row.mode])}</strong><span>${esc(leaseRange224(row))}</span><time>${esc(fmtDateTime(row.at))}</time></summary>
   <p>${esc(row.content)}</p>
  </details>`).join('')||'<p class="muted">尚無通知紀錄</p>';
 }
 function showPane(next){
  if(next===pane)return;
  collectCheck();
  if(pane==='review'&&personal())paymentReview.collect();
  updateTerm();
  if(personal()&&(next==='review'||next==='notice')){
   $('#leaseNoticeDraft228').hidden=true;
   $('#leaseReviewEmpty228').hidden=true;
   $('#leaseReviewLayout228').hidden=true;
   $('#leaseIndividualReview238').hidden=false;
   checkMounted=false;
   if(next==='review'){
    if(validTerm())collect();
    paymentReview.show(validTerm()?periods:[]);
   }
   activate(next);
   return;
  }
  $('#leaseIndividualReview238').hidden=true;
  if(next==='review'||next==='notice'){
   const valid=validTerm();
   $('#leaseReviewEmpty228').hidden=valid;
   $('#leaseReviewLayout228').hidden=!valid;
   $('#leaseNoticeDraft228').hidden=!valid;
   if(valid){
    collect();
    ensurePeriod(next==='review'&&pane==='deposit'?interestYear.value:undefined);
    if(next==='review'){drawPeriods();drawCheck();}
    else{
     $('#leaseNoticeRange228').innerHTML=periods.map(period=>leaseOption224(period.key,leaseRange224(period),selectedKey)).join('');
     drawNotice();
    }
   }
  }
  checkMounted=next==='review'&&validTerm();
  activate(next);
 }
 const tabButtons=[...modal.querySelectorAll('[data-lease-tab]')];
 for(const [index,button] of tabButtons.entries()){
  button.onclick=()=>attempt(()=>showPane(button.dataset.leaseTab));
  button.onkeydown=event=>{
   const last=tabButtons.length-1;
   const target={ArrowLeft:index===0?last:index-1,ArrowRight:index===last?0:index+1,Home:0,End:last}[event.key];
   if(target===undefined)return;
   event.preventDefault();
   tabButtons[target].click();
   if(tabButtons[target].getAttribute('aria-selected')==='true')tabButtons[target].focus();
  };
 }
 $('#leaseNoticeRange228').onchange=event=>{selectedKey=event.target.value;drawNotice();};
 list.onclick=event=>{
  const button=event.target.closest('[data-lease-period]');
  if(!button||button.dataset.leasePeriod===selectedKey)return;
  attempt(()=>{
   collect();selectedKey=button.dataset.leasePeriod;
   drawPeriods();drawCheck();
   list.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});
  });
 };
 years.onchange=()=>{
  const year=years.value;
  years.value=periods.find(period=>period.key===selectedKey).year;
  attempt(()=>{collect();ensurePeriod(year);drawPeriods();drawCheck();});
 };
 noticeMode.onchange=()=>drawNotice();
 noticeText.oninput=()=>{notices.set(noticeKey,{source:noticeText.dataset.generated,text:noticeText.value});copy.disabled=$('#leaseRecordNotice228').disabled=!noticeText.value.trim();};
 $('#leaseRegenerate224').onclick=()=>drawNotice(true);
 copy.onclick=async()=>{
  const value=noticeText.value.trim();
  if(!value)return;
  try{await navigator.clipboard.writeText(value);}
  catch{
   noticeText.focus();noticeText.select();
   if(!document.execCommand('copy')){toast('已選取訊息，請手動複製');return;}
  }
  toast('租約通知已複製');
 };
 $('#leaseRecordNotice228').onclick=()=>{
  const period=periods.find(period=>period.key===selectedKey);
  const content=noticeText.value.trim();
  if(content&&period)recordNotice({at:nowISO(),start:period.start,end:period.end,mode:noticeMode.value,content});
 };
 drawHistory();
 return {
  active:()=>pane,
  busy:()=>busy,
  activate,
  syncMode,
  collectPayments:paymentReview.collect,
  hasUnsaved,
  collect(){
   if(!baseline.lease){
    collectCheck();
    if(costsSnapshot()===initialCosts)return undefined;
   }
   updateTerm();
   if(!validTerm()){
    const error=new Error('請先在基本資料填寫有效的租期起訖日');
    error.field=!term.startDate?'startDate':'endDate';
    throw error;
   }
   collect();
   return draft;
  },
  saved(row){
   baseline=row;
   initial=snapshot();
   initialCosts=costsSnapshot();
   $('#leaseRecoveredRent237')?.remove();
   drawHistory();
  }
 };
}
function revealLease224(node){
 if(!motionEnabled211()||node.hidden)return;
 node.getAnimations().forEach(animation=>animation.cancel());
 node.animate([{opacity:.66,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:185,easing:'cubic-bezier(.2,.75,.2,1)'});
}
