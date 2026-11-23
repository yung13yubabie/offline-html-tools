const leaseEngine224=createLeaseEngine224();
const leaseRates224=()=>state.leaseRates||[];
const leaseMoney224=cents=>cents===null?'待填':(cents/100).toLocaleString('zh-TW',{maximumFractionDigits:2})+' 元';
const leaseYear224=year=>fmtDate(year+'-01-01').split('/')[0]+' 年';
const leaseRange224=period=>fmtDate(period.start)+' ～ '+fmtDate(period.end);
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
 if(period.needsRate&&outcomes.includes('unknown'))return 'unknown';
 if(outcomes.every(value=>value==='matched')||
   outcomes.includes('matched')&&(period.rent===null||period.interest===null))return 'matched';
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
 return {label,value:leaseMoney224(step.cents)+' · '+(lease.rentBasis==='gross'?'含稅':'未稅')};
}
function leaseSummary224(contract){
 const data=contract.lease;
 if(!data)return '';
 const periods=leaseEngine224.calculate(contract,leaseRates224()),rent=leaseRentDisplay225(contract);
 const issues=periods.filter(period=>['missing','different'].includes(leasePeriodStatus224(period))).length;
 return `<dl class="lease-summary224">
  <div><dt>${esc(rent.label)}</dt><dd>${esc(rent.value)}</dd></div>
  <div><dt>押金</dt><dd>${esc(leaseMoney224(data.deposit))}</dd></div>
  <div><dt>${esc(leaseFrequency224[data.frequency])}核對</dt><dd>${issues?statusBadge('待處理','orange')+' '+issues+' 期':periods.length+' 期'}</dd></div>
 </dl>`;
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
 if(includeMissing&&period.rentResult==='missing'){
  lines.push('租金發票尚未開立'+(period.rent===null?'。':`，應開${basis}金額為 ${leaseMoney224(period.rent)}。`));
 }
 if((mode==='issues'||mode==='rent')&&period.rentResult==='different'){
  lines.push(`租金${basis}金額有差異，依約應開 ${leaseMoney224(period.rent)}，實際開立 ${leaseMoney224(period.check.rentActual)}。`);
 }
 if(includeMissing&&period.interestResult==='missing'){
  lines.push('押金設算利息尚未開立'+(period.interest===null?'。':`，應列銷售額為 ${leaseMoney224(period.interest)}。`));
 }
 if((mode==='interest'&&period.interest!==null&&period.interest>0)||(mode==='issues'&&period.interestResult==='different')){
  const annual=period.annual===null?'':`，郵政年利率 ${leaseEngine224.format(period.annual,4)}%，計 ${period.interestMonths} 個月`;
  const actual=period.check.interestActual===null?'':`，實際列示 ${leaseMoney224(period.check.interestActual)}`;
  lines.push(`押金設算利息銷售額為 ${leaseMoney224(period.interest)}${annual}${actual}。`);
 }
 if(!lines.length)return '';
 return [name?name+' 您好：':'您好：',`關於「${contract.title}」${leaseRange224(period)} 的租賃發票，想請您協助核對以下項目：`,
  ...lines.map((line,index)=>`${index+1}. ${line}`),'','煩請確認後回覆，謝謝。'].join('\n');
}

const contractTabs228=[['basic','基本資料'],['setup','租金與押息'],['review','逐期核對'],['notice','通知紀錄']];
const leaseNoticeModes228={issues:'全部已確認異常',missing:'漏開發票',rent:'租金金額差異',interest:'押金設算利息'};
const leaseField228=(id,label,type,properties='')=>`<label class="field" for="${id}">${label}<input id="${id}" class="input" type="${type}" ${properties}></label>`;
function contractLeasePanels228(contract,basic){
 const lease=contract.lease||leaseEngine224.defaultLease(),field=leaseField228;
 const panel=(key,html)=>`<section id="lease-pane-${key}" class="lease-pane224" role="tabpanel" aria-labelledby="lease-tab-${key}" ${key==='basic'?'':'hidden'}>${html}</section>`;
 return `<div class="lease-workspace224">
  <p class="contract-manager-context228" id="contractManagerContext228"></p>
  <nav class="lease-tabs224" role="tablist" aria-label="合約管理">${contractTabs228.map(([id,title])=>
   `<button class="btn" type="button" role="tab" data-lease-tab="${id}" id="lease-tab-${id}" aria-controls="lease-pane-${id}" aria-selected="${id==='basic'}" tabindex="${id==='basic'?0:-1}">${title}</button>`).join('')}</nav>
  <div id="leaseError224" class="notice warn" role="alert" tabindex="-1" hidden></div>
  ${panel('basic',basic)}
  ${panel('setup',`
   <div class="lease-fields224">
    <label class="field">核對週期<select id="leaseFrequency224" class="select">${leaseEngine224.frequencies.map(key=>leaseOption224(key,leaseFrequency224[key],lease.frequency)).join('')}</select></label>
    <label class="field">月租金額基準<select id="leaseRentBasis224" class="select">${[['net','未稅'],['gross','含稅']].map(([key,label])=>leaseOption224(key,label,lease.rentBasis)).join('')}</select></label>
    ${field('leaseDeposit224','押金（元）','text','inputmode="decimal" placeholder="待填"')}
    <label class="field">押息計算方式<select id="leaseRegime224" class="select">${[['invoice','一般稅額'],['assessed','查定計算']].map(([key,label])=>leaseOption224(key,label,lease.regime)).join('')}</select></label>
    ${field('leaseVAT224','營業稅徵收率（%）','text','inputmode="decimal"')}
   </div>
   <section class="lease-section224">
    <header><h3>租金階段</h3><button class="btn" type="button" id="leaseAddStep224">新增階段</button></header>
    <div id="leaseSteps224"></div>
   </section>
   <details class="lease-section224 lease-post224"><summary>年度郵政利率</summary><div id="leaseRateChips224"></div></details>
  `)}
  ${panel('review',`
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
 const steps=$('#leaseSteps224'),years=$('#leaseYear224'),list=$('#leasePeriods224'),checkPanel=$('#leaseCheck224');
 const notices=new Map(),noticeMode=$('#leaseNoticeMode224'),noticeText=$('#leaseNoticeText224'),copy=$('#leaseCopy224');
 let pane='basic',periods=[],selectedKey='',noticeKey='',busy=false,checkMounted=false;
 const val=id=>$('#'+id).value;
 const format=leaseEngine224.format;
 $('#leaseDeposit224').value=format(draft.deposit);
 $('#leaseVAT224').value=format(draft.vatRate,4);

 function appendStep(from='',cents=null,opening=false){
  steps.insertAdjacentHTML('beforeend',`<div class="lease-step224">
   <label class="field">生效日<input class="input lease-step-date" type="date" min="${esc(term.startDate)}" max="${esc(term.endDate)}" value="${esc(from)}" ${opening?'readonly':''}></label>
   <label class="field">${opening?'首段月租（元）':'月租（元）'}<input class="input lease-step-rent" inputmode="decimal" value="${esc(format(cents))}"></label>
   ${opening?'':'<button class="btn danger" type="button" data-lease-remove-step>移除</button>'}</div>`);
 }
 appendStep(baseline.startDate,draft.steps[0]?.cents??null,true);
 draft.steps.slice(1).forEach(step=>appendStep(step.from,step.cents));
 $('#leaseAddStep224').onclick=()=>{
  if(steps.childElementCount>=120){toast('租金階段最多 120 筆');return;}
  appendStep();
  steps.lastElementChild.querySelector('.lease-step-rent').focus();
 };
 steps.onclick=event=>{const remove=event.target.closest('[data-lease-remove-step]');if(remove){remove.closest('.lease-step224').remove();$('#leaseAddStep224').focus();}};
 const showRegime=()=>{$('#leaseVAT224').closest('label').hidden=val('leaseRegime224')==='assessed';};
 $('#leaseRegime224').onchange=showRegime;
 showRegime();
 function setupSnapshot(){
  return [val('leaseFrequency224'),val('leaseRentBasis224'),val('leaseDeposit224'),val('leaseRegime224'),val('leaseVAT224'),
   [...steps.querySelectorAll('input:not([readonly])')].map(input=>input.value)];
 }
 const snapshot=()=>JSON.stringify([setupSnapshot(),draft.checks]);
 const hasUnsaved=()=>{
  if(checkMounted){
   try{collectCheck();}catch{return true;}
  }
  return snapshot()!==initial;
 };
 let initial=snapshot();
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
  const months=val('leaseInterestMonths224');
  const row={key:selectedKey,interestMonths:months===''?null:Number(months)};
  for(const part of ['rent','interest']){
   const status=val('lease-'+part+'-status224');
   row[part+'Status']=status;
   row[part+'Actual']=status==='issued'?leaseEngine224.amount(val('lease-'+part+'-actual224')):null;
  }
  const normalized=leaseEngine224.normalize({...draft,checks:[...draft.checks.filter(row=>row.key!==selectedKey),row]},term.startDate,term.endDate);
  draft.checks=normalized.checks.sort((a,b)=>a.key.localeCompare(b.key));
 }
 function collect(){
  collectCheck();
  updateTerm();
  const rentBasis=val('leaseRentBasis224');
  if(rentBasis!==draft.rentBasis&&draft.checks.some(check=>check.rentActual!==null)){
   throw Error('已有實開租金金額，請先清除該期金額再變更含稅／未稅基準');
  }
  const vatRate=leaseEngine224.rate(val('leaseVAT224'));
  if(val('leaseRegime224')==='invoice'&&vatRate===null)throw Error('請填寫營業稅徵收率');
  const newSteps=[...steps.querySelectorAll('.lease-step224')].map(row=>({
   from:row.querySelector('.lease-step-date').value,cents:leaseEngine224.amount(row.querySelector('.lease-step-rent').value)
  }));
  if(newSteps.length===1&&newSteps[0].cents===null)newSteps.pop();
  draft=leaseEngine224.normalize({...draft,frequency:Number(val('leaseFrequency224')),rentBasis,
   deposit:leaseEngine224.amount(val('leaseDeposit224')),regime:val('leaseRegime224'),vatRate:vatRate??draft.vatRate,steps:newSteps},term.startDate,term.endDate);
  periods=leaseEngine224.calculate({...term,lease:draft},leaseRates224());
 }
 function attempt(action){
  if(busy)return;
  error.hidden=true;
  try{action();}catch(failure){error.textContent=failure.message;error.hidden=false;error.focus();}
 }
 function drawRateChips(){
  const target=$('#leaseRateChips224');
  target.parentElement.hidden=!validTerm();
  if(target.parentElement.hidden)return;
  const rows=new Map(leaseRates224().map(rate=>[rate.id,rate.rate]));
  const start=Number(term.startDate.slice(0,4)),end=Number(term.endDate.slice(0,4));
  const all=Array.from({length:Math.min(101,end-start+1)},(_,i)=>String(start+i).padStart(4,'0'));
  target.innerHTML=all.map(year=>`<span class="lease-rate-chip224">${esc(leaseYear224(year))} ${rows.has(year)?'<strong>'+esc(format(rows.get(year),4))+'%</strong>':'<span>未設定</span>'}</span>`).join('');
 }
 function activate(next){
  pane=next;
  if(next==='basic')checkMounted=false;
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
  const options=[['pending','待核對'],['issued','已開立'],['missing','未開立']];
  return `<section class="lease-metric224">
    <header><h3>${label}</h3><span data-lease-outcome="${part}">${leaseOutcomeBadge224(period[part+'Result'])}</span></header>
    <dl><div><dt>應開・${basis}</dt><dd data-lease-expected="${part}">${esc(leaseMoney224(expected))}</dd></div>
    <div><dt>差額・實開減應開</dt><dd data-lease-delta="${part}">${expected!==null&&actual!==null?esc(leaseMoney224(actual-expected)):'—'}</dd></div></dl>
    <div class="lease-fields224">
     <label class="field">發票狀態<select class="select" id="lease-${part}-status224">${options.map(([key,title])=>leaseOption224(key,title,status)).join('')}</select></label>
     <label class="field" id="lease-${part}-field224" ${status==='issued'?'':'hidden'}>實開・${basis}<input class="input" id="lease-${part}-actual224" inputmode="decimal" value="${esc(format(actual))}"></label>
    </div>
    ${part==='interest'?`<div class="lease-interest224"><div><span>年利率</span> <strong>${period.annual===null?'未設定':esc(format(period.annual,4))+'%'}</strong></div>
      <div data-lease-gross>設算息 ${esc(leaseMoney224(period.gross))}</div>
      ${field('leaseInterestMonths224','計息月數','number',`min="0" max="${period.months.length}" step="1" placeholder="${period.fullMonths}" value="${esc(period.check.interestMonths??'')}"`)}</div>
      ${period.needsRate?`<div class="lease-rate-quick224">
       ${field('leaseQuickRate224',leaseYear224(period.year)+'郵政固定利率（%）','text','inputmode="decimal"')}
       <button class="btn" type="button" id="leaseSaveQuickRate224">儲存利率</button></div>`:''}`:''}
   </section>`;
 }
 function drawCheck(){
  const period=periods.find(period=>period.key===selectedKey);
  checkPanel.innerHTML=`<header class="lease-check-head224"><h3>${esc(leaseRange224(period))}</h3><button class="btn" type="button" id="leaseDraftNotice224">建立通知</button></header>
   <div class="lease-metrics224">${metric(period,'rent','租金',draft.rentBasis==='net'?'未稅':'含稅')}${metric(period,'interest','押金設算利息','銷售額')}</div>`;
  checkMounted=true;
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
   const actual=period.check[part+'Actual'],expected=period[part];
   checkPanel.querySelector(`[data-lease-expected="${part}"]`).textContent=leaseMoney224(expected);
   checkPanel.querySelector(`[data-lease-delta="${part}"]`).textContent=expected!==null&&actual!==null?leaseMoney224(actual-expected):'—';
   checkPanel.querySelector(`[data-lease-outcome="${part}"]`).innerHTML=leaseOutcomeBadge224(period[part+'Result']);
  }
  checkPanel.querySelector('[data-lease-gross]').textContent='設算息 '+leaseMoney224(period.gross);
  const button=[...list.children].find(button=>button.dataset.leasePeriod===selectedKey);
  if(button)button.querySelector('.badge').outerHTML=leaseOutcomeBadge224(leasePeriodStatus224(period));
 }
 checkPanel.onchange=event=>{
  if(!checkMounted||!event.target.matches('input,select')||event.target.id==='leaseQuickRate224')return;
  for(const part of ['rent','interest']){
   const visible=val('lease-'+part+'-status224')==='issued';
   $('#lease-'+part+'-field224').hidden=!visible;
  }
  attempt(()=>{
   collect();
   const period=periods.find(period=>period.key===selectedKey);
   if(period.needsRate!==!!$('#leaseQuickRate224')){
    drawPeriods();drawCheck();
    $('#leaseInterestMonths224').focus({preventScroll:true});
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
  updateTerm();
  if(next==='setup')drawRateChips();
  if(next==='review'||next==='notice'){
   const valid=validTerm();
   $('#leaseReviewEmpty228').hidden=valid;
   $('#leaseReviewLayout228').hidden=!valid;
   $('#leaseNoticeDraft228').hidden=!valid;
   if(valid){
    collect();
    ensurePeriod();
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
  hasUnsaved,
  collect(){
   if(!baseline.lease&&!hasUnsaved())return undefined;
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
   drawHistory();
  }
 };
}
function revealLease224(node){
 if(!motionEnabled211()||node.hidden)return;
 node.getAnimations().forEach(animation=>animation.cancel());
 node.animate([{opacity:.66,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:185,easing:'cubic-bezier(.2,.75,.2,1)'});
}
