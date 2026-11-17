/* Connected source records travel together in partial backups. */
function createCrossPeriodBackupEngine218(){
 const copy=x=>JSON.parse(JSON.stringify(x));
 function close(selected,full){
  const out=copy(selected),rows=full.periodClients||[],byId=new Map(rows.map(pc=>[pc.id,pc])),edges=new Map(rows.map(pc=>[pc.id,new Set()])),groups=new Map(),receipts=new Map();
  const edge=(a,b)=>{if(a===b||!byId.has(a)||!byId.has(b))return;edges.get(a).add(b);edges.get(b).add(a)};
  for(const pc of rows){
   for(const field of ['accountingMissingDocs','accountingReturnItems'])for(const item of pc[field]||[]){const root=item.lineageRootId||item.sourceItemId||item.id;if(!root)continue;const key=JSON.stringify([pc.clientId,field,item.sourcePeriodId||pc.periodId,root]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(pc.id);const actor=byId.get(item.accountingLink218?.changedPCId);if(actor?.clientId===pc.clientId)edge(pc.id,actor.id);}
   for(const pay of pc.payments||[]){for(const a of pay.allocationRecord?.allocations||[])edge(pc.id,a.sourcePCId);if(pay.groupPayment214?.receiptId){const id=pay.groupPayment214.receiptId;if(!receipts.has(id))receipts.set(id,new Set());receipts.get(id).add(pc.id);}}
   for(const item of pc.openingSnapshot210||[])edge(pc.id,item.sourcePCId);
   edge(pc.id,pc.priorCarrySourcePCId218);edge(pc.id,pc.carryInvoiceResolution218?.handlerPCId);
   for(const header of pc.groupPaymentReceipts214||[]){if(!receipts.has(header.receiptId))receipts.set(header.receiptId,new Set());receipts.get(header.receiptId).add(pc.id);for(const share of header.shares||[])receipts.get(header.receiptId).add(share.pcId);}
  }
  for(const ids of [...groups.values(),...[...receipts.values()].map(x=>[...x])])for(let i=1;i<ids.length;i++)edge(ids[0],ids[i]);
  const selectedRows=new Map((out.periodClients||[]).map(pc=>[pc.id,copy(byId.get(pc.id)||pc)])),queue=[...selectedRows.keys()];
  for(let i=0;i<queue.length;i++)for(const id of edges.get(queue[i])||[])if(!selectedRows.has(id)){selectedRows.set(id,copy(byId.get(id)));queue.push(id);}
  out.periodClients=[...selectedRows.values()];for(const pc of out.periodClients)delete pc.invoiceHandlingRequests218;
  const periodIds=new Set(out.periodClients.map(pc=>pc.periodId)),clientIds=new Set(out.periodClients.map(pc=>pc.clientId)),periods=new Map((out.periods||[]).map(p=>[p.id,p])),clients=new Map((out.clients||[]).map(c=>[c.id,c]));
  for(const p of full.periods||[])if(periodIds.has(p.id))periods.set(p.id,copy(p));for(const c of full.clients||[])if(clientIds.has(c.id))clients.set(c.id,copy(c));out.periods=[...periods.values()];out.clients=[...clients.values()];
  return out;
 }
 function validate(data){
  const pcs=new Map((data.periodClients||[]).map(pc=>[pc.id,pc]));
  for(const pc of data.periodClients||[]){
   if(pc.invoiceHandlingRequests218!=null)throw new Error('備份含未儲存的跨期發票操作，請重新匯出已儲存資料');
   for(const field of ['accountingMissingDocs','accountingReturnItems'])for(const item of pc[field]||[]){const link=item.accountingLink218;if(link==null)continue;if(pcs.has(link.changedPCId)&&pcs.get(link.changedPCId).clientId!==pc.clientId)throw new Error('跨期帳務操作來源不能屬於其他客戶');if(typeof link!=='object'||link.version!==1||!Number.isSafeInteger(link.revision)||link.revision<1||!['pending','done'].includes(link.status)||link.status!==item.status||typeof link.changedPCId!=='string'||!link.changedPCId||typeof link.changedAt!=='string'||!Number.isFinite(Date.parse(link.changedAt))||typeof link.completedAt!=='string'||link.completedAt!==''&&!Number.isFinite(Date.parse(link.completedAt)))throw new Error('跨期帳務聯動紀錄無效，尚未匯入');}
   const res=pc.carryInvoiceResolution218;if(res!=null&&(typeof res!=='object'||res.version!==1||res.sourcePCId!==pc.id||res.sourcePeriodId!==pc.periodId||typeof res.handled!=='boolean'||!Number.isSafeInteger(res.revision)||res.revision<1))throw new Error('跨期發票聯動紀錄無效，尚未匯入');
  }
  return true;
 }
 return {close,validate};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createCrossPeriodBackupEngine218};
if(typeof state!=='undefined'){
 const beforeClose218=closeGroupBackup214;closeGroupBackup214=function(data){return createCrossPeriodBackupEngine218().close(beforeClose218(data),{periodClients:state.periodClients,periods:state.periods,clients:state.clients})};
 const beforeValidation218=validateBackup210;validateBackup210=function(b){beforeValidation218(b);createCrossPeriodBackupEngine218().validate(b.data)};
 const beforeReferences218=validateBackupReferences211;validateBackupReferences211=function(data){beforeReferences218(data);createCrossPeriodBackupEngine218().validate(data)};
}
if(typeof document!=='undefined'){
 const backupWireBefore218=wire;wire=function(){backupWireBefore218();const host=$('#partialScope')?.closest('.card-b');if(host&&!$('#crossPeriodBackupHint218')){const p=document.createElement('p');p.id='crossPeriodBackupHint218';p.className='small muted';p.textContent='部分備份會一併包含跨期來源、後期沖抵與合併付款的關聯資料。';host.append(p);}};
}
