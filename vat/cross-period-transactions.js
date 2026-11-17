/* v2.18 — shared source progress commits with the edit, never in a second write. */
let crossPeriodBaseline218=null,crossPeriodLoading218=false;
function planPeriodLinks218(beforeRows,proposedRows,periods,changedIds,at,{baselineRows=null,mode='edit',resolutions=[]}={}){
 const input={beforeRows,proposedRows,periods,changedIds,at,baselineRows:baselineRows||beforeRows,mode,resolutions};
 const accounting=createAccountingLinkEngine218().plan(input);
 const invoice=createInvoiceLinkEngine218().plan({...input,proposedRows:accounting.periodClients,changedIds:[...new Set([...changedIds,...accounting.changedIds])]});
 return {periodClients:invoice.periodClients,changedIds:[...new Set([...accounting.changedIds,...invoice.changedIds])],events:{accounting:accounting.events,invoice:invoice.events}};
}
function pcNonSharedSignature218(pc){
 if(!pc)return null;const copy=clone(pc);delete copy.updatedAt;delete copy.accountingCompletedAt;
 for(const key of ['carryInvoiceResolution218','priorCarrySourcePCId218','priorCarrySourcePeriodId218','priorCarryInvoiceHandled','invoiceHandlingRequests218','invoiceCarryReview218'])delete copy[key];
 for(const field of ['accountingMissingDocs','accountingReturnItems'])for(const x of copy[field]||[]){delete x.status;delete x.completedAt;delete x.accountingLink218;delete x.updatedAt;if(x.taskPlan)delete x.taskPlan.reminderCompletedAt;}
 const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;return JSON.stringify(stable(copy));
}
function preserveCompletion218(next,before,baseline){
 if(!before||!baseline)return next;
 if((next.accountingCompletedAt||'')===(baseline.accountingCompletedAt||''))next.accountingCompletedAt=before.accountingCompletedAt||'';
 else if((before.accountingCompletedAt||'')!==(baseline.accountingCompletedAt||'')&&(next.accountingCompletedAt||'')!==(before.accountingCompletedAt||''))throw new Error('帳務完成狀態已由其他視窗更新，請重新開啟後再操作');
 return next;
}
function applyRowOps218(rows,ops,store){const map=new Map(rows.map(x=>[x.id,clone(x)]));for(const op of ops.filter(o=>o.store===store)){if(op.action==='clear')map.clear();else if(op.action==='delete')map.delete(op.id);else map.set(op.value.id,clone(op.value));}return [...map.values()];}
const writeBatchBefore218=writeBatch210;
writeBatch210=function(ops,options={}){
 if(!ops.some(o=>o.store==='periodClients'))return writeBatchBefore218(ops);
 const baselineRows=clone(options.baselineRows||crossPeriodBaseline218||state.periodClients||[]),cleared=ops.some(o=>o.store==='periodClients'&&o.action==='clear'),maintenance=crossPeriodLoading218||options.linkMode218==='seed'||options.linkMode218==='restore'||cleared,mode=maintenance?'seed':'edit';
 return new Promise((resolve,reject)=>{
  let tr,rows,periods,result,failure;const fail=e=>{failure=e;try{tr.abort()}catch{}reject(e)};
  try{tr=db.transaction([...new Set([...ops.map(o=>o.store),'periodClients','periods'])],'readwrite')}catch(e){reject(e);return}
  const store=tr.objectStore('periodClients'),pr=tr.objectStore('periods').getAll(),rr=store.getAll();
  const build=()=>{if(!rows||!periods||failure)return;try{
   const nextPeriods=applyRowOps218(periods,ops,'periods'),proposed=applyRowOps218(rows,ops,'periodClients'),directIds=ops.filter(o=>o.store==='periodClients'&&!o.action).map(o=>o.value.id);
   if(!maintenance)for(const id of directIds){const before=rows.find(pc=>pc.id===id),baseline=baselineRows.find(pc=>pc.id===id),next=proposed.find(pc=>pc.id===id);if(before&&baseline&&pcNonSharedSignature218(before)!==pcNonSharedSignature218(baseline))throw new Error((before.snapshot?.name||'客戶')+' 的資料已由其他視窗更新，請重新開啟後再儲存');preserveCompletion218(next,before,baseline);}
   result=planPeriodLinks218(cleared?proposed:rows,proposed,nextPeriods,directIds,nowISO(),{baselineRows:cleared?proposed:baselineRows,mode,resolutions:options.resolutions||[]});
   const planned=new Map(result.periodClients.map(pc=>[pc.id,pc])),written=new Set();
   for(const op of ops){const target=tr.objectStore(op.store);if(op.action==='clear')target.clear();else if(op.action==='delete')target.delete(op.id);else{const value=op.store==='periodClients'?planned.get(op.value.id):op.value;if(value){target.put(value);if(op.store==='periodClients')written.add(value.id);}}}
   for(const id of result.changedIds)if(!written.has(id)&&planned.has(id)){const pc=planned.get(id);pc.updatedAt=nowISO();store.put(pc);}
   result.periods=nextPeriods;
  }catch(e){fail(e)}};
  rr.onsuccess=()=>{rows=rr.result;build()};pr.onsuccess=()=>{periods=pr.result;build()};
  tr.oncomplete=()=>{crossPeriodBaseline218=clone(result.periodClients);resolve(result)};tr.onerror=()=>{};tr.onabort=()=>reject(failure||tr.error||new Error('跨期聯動未完成，所有變更已取消'));
 });
};
put=async function(store,obj){
 if(store!=='periodClients'){await writeBatch210([{store,value:clone(obj)}]);return obj;}
 const next=preparedPC210(obj,await getOne(store,obj.id)),result=await writeBatch210([{store,value:next}]),saved=result.periodClients.find(pc=>pc.id===obj.id);if(saved)Object.assign(obj,clone(saved));return obj;
};
putClientAndPeriod=async function(client,pc){return writeBatch210([{store:'clients',value:clone(client)},{store:'periodClients',value:preparedPC210(pc,await getOne('periodClients',pc.id))}]);};
function seedPeriodLinks218(){return new Promise((resolve,reject)=>{
 const tr=db.transaction(['periodClients','periods'],'readwrite'),store=tr.objectStore('periodClients');let rows,periods,result,failure;
 const build=()=>{if(!rows||!periods)return;try{result=planPeriodLinks218(rows,rows,periods,[],nowISO(),{baselineRows:rows,mode:'seed'});for(const id of result.changedIds){const pc=result.periodClients.find(x=>x.id===id);if(pc)store.put(pc);}}catch(e){failure=e;try{tr.abort()}catch{}}};
 const rr=store.getAll(),pr=tr.objectStore('periods').getAll();rr.onsuccess=()=>{rows=rr.result;build()};pr.onsuccess=()=>{periods=pr.result;build()};tr.oncomplete=()=>resolve({...result,periods});tr.onerror=()=>{};tr.onabort=()=>reject(failure||tr.error||new Error('無法核對跨期狀態'));
 });}
async function resolveAccountingLink218({pcId,field,itemId,status,baselineRows}){
 const baseline=clone(baselineRows||crossPeriodBaseline218||state.periodClients),owner=baseline.find(pc=>pc.id===pcId);if(!owner)throw new Error('來源已不存在，請重新核對');
 return new Promise((resolve,reject)=>{const tr=db.transaction(['periodClients','periods'],'readwrite'),store=tr.objectStore('periodClients');let rows,periods,result,failure;
 const build=()=>{if(!rows||!periods)return;try{result=planPeriodLinks218(rows,rows,periods,[pcId],nowISO(),{baselineRows:baseline,mode:'resolve',resolutions:[{pcId,field,itemId,status}]});for(const id of result.changedIds){const next=result.periodClients.find(pc=>pc.id===id);if(next)store.put(next);}}catch(e){failure=e;try{tr.abort()}catch{}}};const rr=store.getAll(),pr=tr.objectStore('periods').getAll();rr.onsuccess=()=>{rows=rr.result;build()};pr.onsuccess=()=>{periods=pr.result;build()};tr.oncomplete=()=>{crossPeriodBaseline218=clone(result.periodClients);resolve(result)};tr.onerror=()=>{};tr.onabort=()=>reject(failure||tr.error||new Error('跨期核對未儲存，所有變更已取消'));
 });
}
const renderLinksBefore218=renderAll;
renderAll=function(){if(!crossPeriodLoading218)return renderLinksBefore218();};
const loadLinksBefore218=loadAll;
loadAll=async function(){const app=$('.app'),wasInert=!!app?.inert,wasBusy=app?.getAttribute('aria-busy');crossPeriodLoading218=true;if(app){app.inert=true;app.setAttribute('aria-busy','true');}try{await loadLinksBefore218();const result=await seedPeriodLinks218();state.periodClients=result.periodClients;state.periods=result.periods;crossPeriodBaseline218=clone(result.periodClients);}finally{crossPeriodLoading218=false;if(app){app.inert=wasInert;if(wasBusy==null)app.removeAttribute('aria-busy');else app.setAttribute('aria-busy',wasBusy);}}renderAll();};
