/* Independent records share one fresh reference check with client deletion and restore. */
const recordReferenceStores220=['clients','cases','contracts','contractCategories'];
function needsRecordReferenceCheck220(ops){
 return ops.some(op=>recordReferenceStores220.includes(op.store)&&
  (op.store!=='clients'||['clear','delete'].includes(op.action)));
}
function guardRecordReferences220(transaction,ops,ready,fail){
 if(!needsRecordReferenceCheck220(ops)){ready();return;}
 const requests=recordReferenceStores220.map(store=>transaction.objectStore(store).getAll());
 let checked=false;
 const check=()=>{
  if(checked||requests.some(request=>request.readyState!=='done'))return;
  checked=true;
  try{
   const data=Object.fromEntries(recordReferenceStores220.map((store,index)=>[store,applyRowOps218(requests[index].result,ops,store)]));
   if(ops.some(op=>op.store==='clients'&&op.action==='delete')){
    const ids=new Set(data.clients.map(client=>client.id));
    if(data.cases.some(row=>!ids.has(row.clientId)))throw Error('此客戶仍有案件，請先改選案件的客戶或刪除案件');
    if(data.contracts.some(row=>!ids.has(row.clientId)))throw Error('此客戶仍有合約，請先改選合約的客戶或刪除合約');
   }
   validateCases219(data);
   contractEngine220.validate(data);
   ready();
  }catch(error){fail(error);}
 };
 requests.forEach(request=>request.onsuccess=check);
}
const writeRecordsBefore220=writeBatch210;
writeBatch210=function(ops,options={}){
 if(ops.some(op=>op.store==='periodClients')||!needsRecordReferenceCheck220(ops))return writeRecordsBefore220(ops,options);
 return new Promise((resolve,reject)=>{
  let transaction,failure;
  try{transaction=db.transaction([...new Set([...ops.map(op=>op.store),...recordReferenceStores220])],'readwrite');}
  catch(error){reject(error);return;}
  const fail=error=>{failure=error;transaction.abort();};
  guardRecordReferences220(transaction,ops,()=>{
   for(const op of ops){
    const store=transaction.objectStore(op.store);
    if(op.action==='clear')store.clear();
    else if(op.action==='delete')store.delete(op.id);
    else store.put(op.value);
   }
  },fail);
  transaction.oncomplete=()=>resolve();
  transaction.onabort=()=>reject(failure||transaction.error||Error('案件或合約資料未儲存，變更已取消'));
 });
};
const deleteBeforeRecords220=del;
del=function(store,id){return store==='clients'?writeBatch210([{store,action:'delete',id}]):deleteBeforeRecords220(store,id);};
const clearBeforeRecords220=clearStore;
clearStore=function(store){return recordReferenceStores220.includes(store)?writeBatch210([{store,action:'clear'}]):clearBeforeRecords220(store);};
const backupReferencesBefore220=validateBackupReferences211;
validateBackupReferences211=function(data){
 backupReferencesBefore220(data);
 validateCases219(data);
 contractEngine220.validate(data);
};
const backupValidationBefore220=validateBackup210;
validateBackup210=function(backup){
 backupValidationBefore220(backup);
 if(backup.kind!=='full'){
  validateCases219(backup.data,{references:false});
  contractEngine220.validate(backup.data,{references:false});
 }
};
const closeBackupBefore220=closeGroupBackup214;
closeGroupBackup214=function(data){
 const result=closeBackupBefore220(data);
 const ids=new Set((result.clients||[]).map(row=>row.id));
 for(const row of [...(result.cases||[]),...(result.contracts||[])]){
  if(ids.has(row.clientId))continue;
  const client=state.clients.find(customer=>customer.id===row.clientId);
  if(!client)throw Error('案件或合約缺少來源客戶，請先核對客戶庫');
  result.clients.push(clone(client));ids.add(client.id);
 }
 validateCases219(result);
 contractEngine220.validate(result);
 return result;
};
function addContractPartial220(data,scope){
 if(scope==='contracts'||scope==='calendar'){
  data.contracts=clone(contracts220());
  data.contractCategories=clone(customContractTypes220());
 }else if(scope==='clients'||scope==='client'){
  const clients=new Set(data.clients.map(client=>client.id));
  data.contracts=clone(contracts220().filter(row=>clients.has(row.clientId)));
  const types=new Set(data.contracts.map(row=>row.categoryId));
  data.contractCategories=clone(customContractTypes220().filter(row=>types.has(row.id)));
 }
}
const renderBackupBefore220=renderBackup;
renderBackup=function(){
 renderBackupBefore220();
 for(const label of ['案件 '+(state.cases||[]).length,'合約 '+contracts220().length]){
  const node=document.createElement('span');
  node.className='kpi';node.textContent=label;
  $('#backupSummary .kpi-row')?.append(node);
 }
};
