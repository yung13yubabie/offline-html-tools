/* Case references are checked against fresh rows inside the same write transaction. */
function caseBatchTouches219(ops){return ops.some(o=>o.store==='cases'||o.store==='clients'&&['clear','delete'].includes(o.action));}
function caseBatchGuard219(tr,ops,ready,fail){
 if(!caseBatchTouches219(ops)){ready();return;}
 let clients,cases;
 const build=()=>{
  if(!clients||!cases)return;
  try{
   const nextClients=applyRowOps218(clients,ops,'clients');
   const nextCases=applyRowOps218(cases,ops,'cases');
   const deletesClient=ops.some(op=>op.store==='clients'&&op.action==='delete');
   if(deletesClient){
    const ids=new Set(nextClients.map(client=>client.id));
    if(nextCases.some(row=>!ids.has(row.clientId)))throw new Error('此客戶仍有案件，請先改選案件的客戶或刪除案件');
   }
   validateCases219({clients:nextClients,cases:nextCases});
   ready();
  }catch(e){fail(e);}
 };
 const cr=tr.objectStore('clients').getAll(),kr=tr.objectStore('cases').getAll();cr.onsuccess=()=>{clients=cr.result;build()};kr.onsuccess=()=>{cases=kr.result;build()};
}
const writeCasesBefore219=writeBatch210;
writeBatch210=function(ops,options={}){
 if(ops.some(o=>o.store==='periodClients')||!caseBatchTouches219(ops))return writeCasesBefore219(ops,options);
 return new Promise((resolve,reject)=>{let tr,failure;try{tr=db.transaction([...new Set([...ops.map(o=>o.store),'clients','cases'])],'readwrite');}catch(e){reject(e);return;}
 const fail=e=>{failure=e;try{tr.abort()}catch{}};
 caseBatchGuard219(tr,ops,()=>{try{for(const op of ops){const store=tr.objectStore(op.store);if(op.action==='clear')store.clear();else if(op.action==='delete')store.delete(op.id);else store.put(op.value);}}catch(e){fail(e)}},fail);
 tr.oncomplete=()=>resolve();tr.onerror=()=>{};tr.onabort=()=>reject(failure||tr.error||new Error('案件資料未儲存，變更已取消'));
 });
};
const deleteBeforeCases219=del;
del=function(store,id){return store==='clients'?writeBatch210([{store,action:'delete',id}]):deleteBeforeCases219(store,id);};
const clearBeforeCases219=clearStore;
clearStore=function(store){return ['clients','cases'].includes(store)?writeBatch210([{store,action:'clear'}]):clearBeforeCases219(store);};
const backupReferencesBefore219=validateBackupReferences211;
validateBackupReferences211=function(data){backupReferencesBefore219(data);validateCases219(data);};
const backupValidationBefore219=validateBackup210;
validateBackup210=function(b){backupValidationBefore219(b);validateCases219(b.data,{references:b.kind==='full'});};
const closeBackupBefore219=closeGroupBackup214;
closeGroupBackup214=function(data){const result=closeBackupBefore219(data);const ids=new Set((result.clients||[]).map(x=>x.id));for(const row of result.cases||[]){if(ids.has(row.clientId))continue;const client=state.clients.find(c=>c.id===row.clientId);if(!client)throw new Error('案件缺少來源客戶，請先核對客戶庫');result.clients.push(clone(client));ids.add(client.id);}validateCases219(result);return result;};

const renderBackupBeforeCases219=renderBackup;
renderBackup=function(){renderBackupBeforeCases219();const node=document.createElement('span');node.className='kpi';node.textContent='案件 '+(state.cases||[]).length;$('#backupSummary .kpi-row')?.append(node);};
