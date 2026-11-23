/* Linked cross-period invoice batches. A source batch keeps its original carry flag. */
function createInvoiceLinkEngine218(){
 const own=(x,k)=>Object.prototype.hasOwnProperty.call(x||{},k),copy=x=>JSON.parse(JSON.stringify(x)),field='carryInvoiceResolution218';
 const fail=message=>{throw new Error(message)},validId=x=>typeof x==='string'&&x.length>0&&x.length<=300;
 function environment(rows,periods){const byId=new Map(rows.map(x=>[x.id,x])),ordered=periods.slice().sort((a,b)=>Number(a.year)-Number(b.year)||Number(a.slot)-Number(b.slot)||String(a.id).localeCompare(String(b.id))),ranks=new Map(ordered.map((p,i)=>[p.id,i]));return {rows,byId,ordered,ranks};}
 function previous(pc,env){const pinned=pc?.priorCarrySourcePCId218;if(pinned)return env.byId.get(pinned)||null;const rank=env.ranks.get(pc?.periodId);if(rank==null||rank<1)return null;const pid=env.ordered[rank-1].id;const candidates=env.rows.filter(x=>x.clientId===pc.clientId&&x.periodId===pid);return candidates.length===1?candidates[0]:null;}
 function relation(source,handler,env){return !!source&&!!handler&&source.id!==handler.id&&source.clientId===handler.clientId&&env.ranks.has(source.periodId)&&env.ranks.has(handler.periodId)&&env.ranks.get(source.periodId)<env.ranks.get(handler.periodId);}
 function resolution(source,env,strict=false){const r=source?.[field];if(r==null)return null;const handler=env.byId.get(r.handlerPCId),valid=r&&typeof r==='object'&&!Array.isArray(r)&&r.version===1&&r.sourcePCId===source.id&&r.sourcePeriodId===source.periodId&&typeof r.handled==='boolean'&&Number.isSafeInteger(r.revision)&&r.revision>0&&validId(r.handlerPCId)&&typeof r.handledAt==='string'&&typeof r.updatedAt==='string'&&typeof r.operationId==='string'&&['explicit','legacy'].includes(r.origin)&&(!handler||relation(source,handler,env));if(!valid){if(strict)fail('跨期發票來源或完成紀錄無效，請先核對資料');return null;}return r;}
 function progress(pc,rows,periods){const env=environment(rows,periods),source=env.byId.get(pc?.id)||pc,r=resolution(source,env);return {sourcePCId:source?.id||'',sourcePeriodId:source?.periodId||'',carried:!!source?.carryInvoiceForward,handled:!!r?.handled,pending:!!source?.carryInvoiceForward&&!r?.handled,handlerPCId:r?.handlerPCId||'',handlerPeriodId:env.byId.get(r?.handlerPCId)?.periodId||'',handledAt:r?.handledAt||'',revision:r?.revision||0,review:!!source?.invoiceCarryReview218};}
 function sources(pc,rows,periods){const env=environment(rows,periods);return rows.filter(source=>relation(source,pc,env)&&(source.carryInvoiceForward||source[field]?.handled)).sort((a,b)=>env.ranks.get(a.periodId)-env.ranks.get(b.periodId)||a.id.localeCompare(b.id)).map(source=>({...progress(source,rows,periods),source}));}
 function signature(pc){return JSON.stringify(pc?{id:pc.id,clientId:pc.clientId,periodId:pc.periodId,carryInvoiceForward:!!pc.carryInvoiceForward,resolution:pc[field]||null}:null);}
 function plan(input){
  const {beforeRows=[],proposedRows=beforeRows,periods=[],at='',mode='edit'}=input||{},baselineRows=own(input,'baselineRows')?input.baselineRows:beforeRows;
  if(!Array.isArray(beforeRows)||!Array.isArray(proposedRows)||!Array.isArray(baselineRows)||!Array.isArray(periods))fail('跨期發票資料格式錯誤');
  const rows=copy(proposedRows),env=environment(rows,periods),before=environment(beforeRows,periods),baseline=environment(baselineRows,periods),changed=new Set(input.changedIds||[]),events=[],commands=new Map();
  if(env.byId.size!==rows.length)fail('跨期發票客戶資料重複');
  const legacyIntent=new Map();
  if(mode==='edit')for(const pc of rows){const latest=before.byId.get(pc.id),base=baseline.byId.get(pc.id);if(!latest||!base)continue;
   if(changed.has(pc.id)&&!!pc.priorCarryInvoiceHandled!==!!base.priorCarryInvoiceHandled)legacyIntent.set(pc.id,!!pc.priorCarryInvoiceHandled);
   for(const key of [field,'priorCarrySourcePCId218','priorCarrySourcePeriodId218','invoiceCarryReview218']){
    if(JSON.stringify(pc[key])===JSON.stringify(base[key])){if(own(latest,key))pc[key]=copy(latest[key]);else delete pc[key];}
    else if(JSON.stringify(pc[key])!==JSON.stringify(latest[key]))fail('跨期發票共享狀態已更新，請重新核對，不能以舊資料覆寫');
   }
   if(!legacyIntent.has(pc.id))pc.priorCarryInvoiceHandled=!!latest.priorCarryInvoiceHandled;
  }

  for(const pc of rows){if(!validId(pc.id)||!validId(pc.clientId)||!validId(pc.periodId))fail('跨期發票客戶識別無效');resolution(pc,env,true);if(own(pc,'priorCarrySourcePCId218')&&!validId(pc.priorCarrySourcePCId218))fail('跨期發票來源識別無效');}
  for(const id of changed)if(!env.byId.has(id))fail('跨期發票處理客戶已不存在');
  // Pin the legacy predecessor once. Inserting a period later cannot rebind it.
  const seeds=new Map();
  for(const pc of rows){
   const old=before.byId.get(pc.id),prior=previous(pc,env);
   if(mode==='edit'&&old?.priorCarrySourcePCId218&&pc.priorCarrySourcePCId218!==old.priorCarrySourcePCId218)fail('跨期發票來源已固定，不能改指向其他期別');
   if(!pc.priorCarrySourcePCId218&&prior?.carryInvoiceForward&&relation(prior,pc,env)){pc.priorCarrySourcePCId218=prior.id;pc.priorCarrySourcePeriodId218=prior.periodId;}
   if(pc.priorCarrySourcePCId218){const source=env.byId.get(pc.priorCarrySourcePCId218);if(!source||!relation(source,pc,env)){pc.invoiceCarryReview218={reason:source?'來源關係不符':'來源資料缺席',sourcePCId:pc.priorCarrySourcePCId218};continue;}pc.priorCarrySourcePeriodId218=source.periodId;if((mode==='edit'?old?.priorCarryInvoiceHandled:pc.priorCarryInvoiceHandled)&&!source[field]&&(source.carryInvoiceForward||mode==='edit'&&before.byId.get(source.id)?.carryInvoiceForward)){const list=seeds.get(source.id)||[];list.push(pc);seeds.set(source.id,list);}else if(source[field])delete pc.invoiceCarryReview218;else if(pc.priorCarryInvoiceHandled&&!source.carryInvoiceForward)pc.invoiceCarryReview218={reason:'來源未設定跨期發票',sourcePCId:source.id};}
   else if(pc.priorCarryInvoiceHandled)pc.invoiceCarryReview218={reason:'舊紀錄無法確認來源',sourcePCId:''};
  }
  // Existing true flags are evidence only when a unique source/handler relationship exists.
  for(const [sourceId,handlers] of seeds){const source=env.byId.get(sourceId);if(handlers.length!==1){source.invoiceCarryReview218={reason:'多筆舊完成紀錄需核對',sourcePCId:sourceId};for(const handler of handlers)handler.invoiceCarryReview218={reason:'多筆舊完成紀錄需核對',sourcePCId:sourceId};continue;}const handler=handlers[0];source[field]={version:1,sourcePCId:source.id,sourcePeriodId:source.periodId,handled:true,handlerPCId:handler.id,handledAt:'',updatedAt:at,revision:1,operationId:'legacy:'+source.id+':1',origin:'legacy'};delete handler.invoiceCarryReview218;}
  function request(handler,sourceId,handled){
   if(!validId(sourceId)||typeof handled!=='boolean')fail('跨期發票處理命令無效');
   const source=env.byId.get(sourceId);if(!source)fail('跨期發票來源資料已不存在，請先核對');if(!relation(source,handler,env))fail('只能處理同一客戶較早期的跨期發票');if(handled&&!source.carryInvoiceForward)fail('來源期未設定跨期發票，不能標記完成');
   const p=periods.find(p=>p.id===handler.periodId);if(p?.status==='已結束'&&!p.unlocked)fail('處理期別已結束，請先解鎖再修改跨期發票');
   const prior=commands.get(sourceId);if(prior&&prior.handled!==handled)fail('同一批跨期發票收到相反操作，請逐筆核對');if(!prior)commands.set(sourceId,{sourceId,handlerId:handler.id,handled});
  }
  if(mode==='edit')for(const pc of rows.filter(x=>changed.has(x.id)).sort((a,b)=>a.id.localeCompare(b.id))){
   const raw=pc.invoiceHandlingRequests218;
   if(raw!=null){if(typeof raw!=='object'||Array.isArray(raw))fail('跨期發票處理命令格式錯誤');for(const key of Object.keys(raw))request(pc,key,raw[key]);}
   const original=baseline.byId.get(pc.id)||before.byId.get(pc.id);
   if(legacyIntent.has(pc.id)&&(!raw||Object.keys(raw).length===0)){const source=previous(pc,env);if(!source)fail('上期跨期發票來源資料缺席，請先核對');if(!pc.priorCarrySourcePCId218){pc.priorCarrySourcePCId218=source.id;pc.priorCarrySourcePeriodId218=source.periodId;}request(pc,pc.priorCarrySourcePCId218,!!pc.priorCarryInvoiceHandled);}
  }
  for(const command of commands.values()){
   const source=env.byId.get(command.sourceId),handler=env.byId.get(command.handlerId),current=resolution(source,env),same=(current?.handled||false)===command.handled&&!(source.invoiceCarryReview218&&!current),latest=before.byId.get(source.id),base=baseline.byId.get(source.id);
   if(!same&&signature(latest)!==signature(base))fail('跨期發票來源已由其他操作更新，請重新載入後再確認');
   if(!same){const revision=(current?.revision||0)+1;if(!Number.isSafeInteger(revision))fail('跨期發票修訂數超出範圍，請先核對');source[field]={version:1,sourcePCId:source.id,sourcePeriodId:source.periodId,handled:command.handled,handlerPCId:handler.id,handledAt:command.handled?at:'',updatedAt:at,revision,operationId:'invoice:'+source.id+':'+revision,origin:'explicit'};events.push({kind:'invoice',action:command.handled?'complete':'reopen',sourcePCId:source.id,sourcePeriodId:source.periodId,handlerPCId:handler.id,handlerPeriodId:handler.periodId,at,operationId:source[field].operationId});}
   delete source.invoiceCarryReview218;delete handler.invoiceCarryReview218;const prior=previous(handler,env);if(handler.priorCarrySourcePCId218===source.id||!handler.priorCarrySourcePCId218&&prior?.id===source.id){handler.priorCarrySourcePCId218=source.id;handler.priorCarrySourcePeriodId218=source.periodId;handler.priorCarryInvoiceHandled=command.handled;}
  }
  // Mirrors make old controls/exports agree with the unique source state; no receipt/tax fields change.
  for(const pc of rows){delete pc.invoiceHandlingRequests218;const source=env.byId.get(pc.priorCarrySourcePCId218),r=source&&resolution(source,env);if(source&&relation(source,pc,env)&&r){pc.priorCarryInvoiceHandled=r.handled;delete pc.invoiceCarryReview218;}if(pc.carryInvoiceForward===false&&resolution(pc,env)?.handled)fail('這批跨期發票已有後期完成紀錄，請先取消處理後再移除跨期旗標');}
  return {periodClients:rows,changedIds:rows.filter(pc=>JSON.stringify(pc)!==JSON.stringify(before.byId.get(pc.id))).map(pc=>pc.id),events};
 }
 return {plan,progress,sources,previous:(pc,rows,periods)=>previous(pc,environment(rows,periods)),signature};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createInvoiceLinkEngine218};

const invoiceLinkPolicy218=createInvoiceLinkEngine218();
function invoiceCarryProgress218(pc){return invoiceLinkPolicy218.progress(pc,state.periodClients,state.periods);}
function invoiceSourcesForPC218(pc){return invoiceLinkPolicy218.sources(pc,state.periodClients,state.periods);}
function invoiceLegacySource218(pc){return invoiceLinkPolicy218.previous(pc,state.periodClients,state.periods);}
function invoiceSourceLabel218(id){const pc=state.periodClients.find(x=>x.id===id),p=state.periods.find(x=>x.id===pc?.periodId);return p?periodLabel(p):pc?.periodId||id||'來源資料缺席';}
function invoiceRequestRows218(pc){
 const rows=invoiceSourcesForPC218(pc),prior=invoiceLegacySource218(pc),requested=pc.invoiceHandlingRequests218||{},render=entry=>{const source=entry.source,checked=Object.prototype.hasOwnProperty.call(requested,source.id)?requested[source.id]:entry.handled,legacy=prior?.id===source.id,label=invoiceSourceLabel218(source.id),handledIn=entry.handlerPeriodId?taskPeriodLabel210(entry.handlerPeriodId):'後期';return `<label class="check-row invoice-source-row218" style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)"><input ${legacy?'id="wPriorCarryHandled"':''} type="checkbox" data-invoice-source218="${esc(source.id)}" data-original-handled218="${entry.handled}" ${legacy?`data-raw-legacy218="${!!pc.priorCarryInvoiceHandled}"`:''} ${checked?'checked':''} style="margin-top:4px"><span style="min-width:0;flex:1"><strong>${esc(label)}</strong><span style="display:block">已確認拿出／處理</span></span><span>${entry.review?statusBadge('待核對','orange'):entry.handled?statusBadge('已處理','green'):statusBadge('待處理','yellow')}${entry.handled?`<span class="small muted" style="display:block">${esc(handledIn)}</span>`:''}</span></label>`;};
 const pending=rows.filter(x=>!x.handled),done=rows.filter(x=>x.handled),review=pc.invoiceCarryReview218,pin=pc.priorCarrySourcePCId218,missing=pin&&!state.periodClients.some(x=>x.id===pin);
 return `<div data-invoice-links218><div class="strong">上期／延續發票</div>${pending.map(render).join('')}${done.length?`<details class="invoice-handled218"><summary style="cursor:pointer;padding:10px 0">已處理 ${done.length} 批</summary>${done.map(render).join('')}</details>`:''}${!rows.length?'<p class="small muted">沒有延續發票</p>':''}${review||missing?`<p class="notice warn">${esc(review?.reason||(pc.priorCarrySourcePeriodId218||'原期別')+' 來源資料缺席')}。原來源關係已保留，請先核對備份或來源資料。</p>`:''}<details class="vat-help217"><summary>說明</summary><p>每一來源期是一批獨立發票。勾選後儲存，來源期與後期會同步顯示；取消勾選會重新開啟同一批，不改變其他期的收件或繳稅紀錄。</p></details></div>`;
}
function captureInvoiceRequests218(pc){if(!pc)return pc;const requests={...(pc.invoiceHandlingRequests218||{})};for(const input of $$('[data-invoice-source218]')){const key=input.dataset.invoiceSource218,original=input.dataset.originalHandled218==='true';if(input.checked===original)delete requests[key];else requests[key]=input.checked;if(input.id==='wPriorCarryHandled')pc.priorCarryInvoiceHandled=input.checked===original?input.dataset.rawLegacy218==='true':input.checked;}
 if(Object.keys(requests).length)pc.invoiceHandlingRequests218=requests;else delete pc.invoiceHandlingRequests218;return pc;}
if(typeof document!=='undefined'&&typeof state!=='undefined'){
 const invoiceCarryBodyBefore218=renderCarryoverBody;
 renderCarryoverBody=function(pc,p){const html=invoiceCarryBodyBefore218(pc,p),index=html.indexOf('<div class="hr"></div>'),prior=priorTaxReference(pc),own=invoiceCarryProgress218(pc),handler=own.handlerPeriodId?taskPeriodLabel210(own.handlerPeriodId):'後期';return `<div class="carry-grid"><div class="carry-box" style="grid-column:1/-1">${invoiceRequestRows218(pc)}</div><div class="carry-box"><div class="carry-title">上期稅額參考</div><div class="carry-value">${prior?`${esc(periodLabel(prior.period))}｜${prior.type} ${money(Math.abs(prior.amount))} 元`:'—'}</div><div class="small muted">只供參考，不帶入本期加總。</div></div><div class="carry-box"><div class="carry-title">本期跨期發票</div><label class="check-row" style="margin-top:6px"><input id="wCarryInvoiceForward" type="checkbox" ${pc.carryInvoiceForward?'checked':''} ${own.handled?'disabled':''}>提醒後期處理本批發票</label><div data-invoice-progress218="${esc(pc.id)}" style="margin-top:8px">${own.handled?statusBadge('已由 '+handler+' 處理','green'):pc.carryInvoiceForward?statusBadge('待後期處理','yellow'):'未設定跨期'}</div>${own.handled?'<div class="small muted">若需移除跨期旗標，先在後期取消本批的已處理狀態。</div>':''}</div></div>`+(index>=0?html.slice(index):'');};
 const invoiceBindBefore218=bindWorkDetail;
 bindWorkDetail=function(pc,p,locked){invoiceBindBefore218(pc,p,locked);$$('[data-invoice-source218]').forEach(input=>{input.disabled=locked;input.onchange=()=>captureInvoiceRequests218(state.workDraft);});};
 const invoiceCaptureBefore218=captureWorkForm210;
 captureWorkForm210=function(){return captureInvoiceRequests218(invoiceCaptureBefore218());};
 const invoicePriorBefore218=priorCarryInvoice;
 priorCarryInvoice=function(pc){if(pc?.priorCarrySourcePCId218){const source=state.periodClients.find(x=>x.id===pc.priorCarrySourcePCId218);return !!source?.carryInvoiceForward;}return invoicePriorBefore218(pc);};
 const invoiceTodosBefore218=todoEvents;
 todoEvents=function(pid=state.periodId){const rows=invoiceTodosBefore218(pid).filter(x=>x.type!=='carryInvoice');for(const pc of pcForPeriod(pid)){if(pc.notApplicable)continue;const pending=invoiceSourcesForPC218(pc).filter(x=>x.pending);if(pending.length)rows.push({id:pc.id+':carryInvoice',pcId:pc.id,type:'carryInvoice',label:'跨期發票待處理',client:pc.snapshot?.name||pc.snapshot?.code||'客戶',code:pc.snapshot?.code||'',detail:`${pending.length} 批｜${pending.map(x=>invoiceSourceLabel218(x.sourcePCId)).join('、')}`,priority:'tracking',tone:'yellow'});}return rows;};
 const invoiceCardBefore218=clientCardHtml;
 clientCardHtml=function(pc,p){let html=invoiceCardBefore218(pc,p);if(invoiceCarryProgress218(pc).handled)html=html.replace('<span class="badge b-red cross-forward-badge">跨下期發票</span>',statusBadge('跨期發票已處理','green'));return html;};
 const invoiceStatsBefore218=workPeriodStatsV24;
 workPeriodStatsV24=function(p){return {...invoiceStatsBefore218(p),carryClients:pcForPeriod(p?.id||state.periodId).filter(pc=>!pc.notApplicable&&invoiceCarryProgress218(pc).pending).length};};
 const invoicePdfSummaryBefore218=pdfCarrySummary;
 pdfCarrySummary=function(pc){const base=invoicePdfSummaryBefore218(pc),sources=invoiceSourcesForPC218(pc),own=invoiceCarryProgress218(pc);return {...base,priorInvoice:sources.length?sources.map(x=>invoiceSourceLabel218(x.sourcePCId)+' '+(x.review?'待核對':x.handled?'已處理':'待處理')).join('；'):pc.invoiceCarryReview218?'來源待核對':'—',currentInvoice:pc.carryInvoiceForward?(own.handled?'已由 '+(own.handlerPeriodId?taskPeriodLabel210(own.handlerPeriodId):'後期')+' 處理':'待後期處理'):'—'};};
 const invoiceSectionBefore218=sectionPage;
 sectionPage=function(p,pcs,sec,page,total){if(sec!=='carryCurrent')return invoiceSectionBefore218(p,pcs,sec,page,total);const rows=pcs.filter(pc=>!!pc.carryInvoiceForward);return `<div class="pdf-page">${pdfHead(p,page,total,'本期跨期發票清單')}${rows.length?`<table class="pdf-table compact"><thead><tr><th>代號</th><th>客戶</th><th>狀態</th><th>處理期別</th></tr></thead><tbody>${rows.map(pc=>{const progress=invoiceCarryProgress218(pc);return `<tr class="pdf-row"><td>${esc(pc.snapshot?.code||'')}</td><td>${esc(pc.snapshot?.name||'')}</td><td>${progress.review?'待核對':progress.handled?'已處理':'待處理'}</td><td>${progress.handlerPeriodId?esc(taskPeriodLabel210(progress.handlerPeriodId)):'—'}</td></tr>`;}).join('')}</tbody></table>`:'<div style="padding:14mm 0;text-align:center;color:#666;font-size:10pt">本期無跨期發票客戶</div>'}<div class="pdf-foot"><span>${esc(periodLabel(p))}</span><span>${page} / ${total}</span></div></div>`;};
 if(typeof PDF_LAYOUT_KNOWN_KEYS212!=='undefined')PDF_LAYOUT_KNOWN_KEYS212.add('c:處理期別');
}
