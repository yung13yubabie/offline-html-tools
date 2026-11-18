'use strict';
const assert = require('node:assert/strict');
const nav=(p,view)=>p.locator('.nav-btn[data-view="'+view+'"]').click();
const toast=(p,text)=>p.locator('.toast').filter({hasText:text}).last().waitFor();
const form=(p)=>p.locator('#caseForm219');
const upload=(p,b)=>p.locator('#restoreFile').setInputFiles({name:'synthetic.taxbackup',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(b))});

async function openEditor(p){
 await nav(p,'cases');
 await p.locator('#casesCards219 [data-open-case219]').click();
 await form(p).waitFor();
}
async function save(p){
 await p.locator('#caseSave219').click();
 await form(p).waitFor({state:'detached'});
}
async function create(p,withReminder){
 await nav(p,'cases');
 await p.locator('#newCase219').click();
 await p.locator('#caseTitle219').fill('合成案件 <示例>');
 await p.locator('#caseClient219').selectOption('synthetic-a');
 assert.match(await p.locator('#caseCustomerPreview219').innerText(),/合成聯絡人[\s\S]*合成測試地址/);
 assert.equal(await p.locator('#caseStatus219').inputValue(),'inProgress');
 await p.locator('#caseStart219').fill('2026-10-30');
 await p.locator('#caseDue219').fill('2026-11-04');
 if(withReminder){
  await p.locator('#caseReminder219').check();
  await p.locator('#caseReminderDate219').fill('2026-10-31');
  await p.locator('#caseReminderTime219').fill('09:00');
 }
 await save(p);
 return p.locator('#casesCards219 [data-case-id219]').getAttribute('data-case-id219');
}

async function lifecycle(p,h){
 await p.clock.setFixedTime(new Date(2026,9,31,8,59));
 const caseId=await create(p,true);
 const link=p.locator('#casesCards219 [data-case-calendar219]');
 await link.click();
 assert.match(await p.locator('#calendarDrawer').innerText(),/案件截止.*合成案件/);
 await nav(p,'today');
 assert.equal(await p.locator('#caseReminderStrip219 [data-open-case219]').count(),0);
 await p.clock.setFixedTime(new Date(2026,9,31,9,0));
 await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 const due=p.locator('#caseReminderStrip219 [data-open-case219]');
 await due.waitFor();
 await p.locator('#todaySystemTab210').click();
 await p.locator('#todayTodos [data-open-case219]').waitFor();
 await p.locator('#todayWorkTab210').click();
 await due.waitFor();
 await nav(p,'calendar');
 // Calendar list filters on the reminder day, which differs from the deadline.
 await p.locator('#calendarListTab').click();
 assert.match(await p.locator('#calendarList').innerText(),/案件提醒.*合成案件/);
 assert.match(await p.locator('#calendarList').innerText(),/案件截止.*合成案件/);
 const reminderCard=p.locator('#calendarList [data-case-calendar-id219^="case-reminder-day:"]');
 await reminderCard.getByRole('button',{name:'確認提醒'}).click();
 await toast(p,'案件提醒已確認');
 await nav(p,'today');
 assert.equal(await due.count(),0);
 await openEditor(p);
 assert.equal(await p.locator('#caseTitle219').inputValue(),'合成案件 <示例>');
 await p.setViewportSize({width:390,height:844});
 assert(await p.locator('.cases-modal219').evaluate(e=>e.getBoundingClientRect().right<=innerWidth));
 await h.screenshot(p,'vat-cases-editor-mobile');
 await p.setViewportSize({width:1440,height:1000});
 await p.locator('#caseStatus219').selectOption('done');
 await save(p);
 assert.equal(await p.locator('#todayTodos [data-open-case219]').count(),0);
 let backup=await h.backup(p);
 assert.equal(backup.data.cases[0].id,caseId);
 assert.equal(backup.data.cases[0].status,'done');
 assert(backup.data.cases[0].completedAt);
 assert.equal(backup.data.calendarNotes.length,1,'Case projection does not store a second record');
 await nav(p,'cases');
 await p.locator('#casesStatus219').selectOption('all');
 await p.locator('#casesCards219 [data-open-case219]').click();
 await p.locator('#caseStatus219').selectOption('inProgress');
 await save(p);
 await nav(p,'today');
 await due.waitFor();

 const peer=await p.context().newPage();
 try{
  await peer.clock.setFixedTime(new Date(2026,9,31,9,0));
  await peer.goto(p.url());
  await openEditor(peer);
  await openEditor(p);
  await p.locator('#caseNote219').fill('合成：先儲存的內容');
  await save(p);
  await peer.locator('#caseNote219').fill('合成：舊分頁草稿');
  await peer.locator('#caseSave219').click();
  await peer.locator('#caseError219').waitFor();
  assert.match(await peer.locator('#caseError219').innerText(),/其他分頁更新/);
  assert.equal(await peer.locator('#caseNote219').inputValue(),'合成：舊分頁草稿');
 }finally{await peer.close();}
 backup=await h.backup(p);
 assert.equal(backup.data.cases[0].note,'合成：先儲存的內容');
 await h.reload(p);
 await openEditor(p);
 assert.equal(await p.locator('#caseNote219').inputValue(),'合成：先儲存的內容');
 p.once('dialog',dialog=>dialog.accept());
 await p.locator('#caseDelete219').click();
 await form(p).waitFor({state:'detached'});
 assert.equal((await h.backup(p)).data.cases.length,0);
}

async function backupAndReferences(p,h){
 const caseId=await create(p,false);
 const current=await h.backup(p);
 assert.equal(current.backupVersion,8);
 await p.locator('#partialScope').selectOption('cases');
 const partial=JSON.parse((await h.download(p,()=>p.locator('#partialExportBtn').click())).toString());
 assert.deepEqual(partial.data.cases.map(row=>row.id),[caseId]);
 assert.deepEqual(partial.data.clients.map(row=>row.id),['synthetic-a']);
 await p.locator('#partialScope').selectOption('period');
 const period=JSON.parse((await h.download(p,()=>p.locator('#partialExportBtn').click())).toString());
 assert.deepEqual(period.data.cases,[],'Period exports exclude cases, which have no period');
 await nav(p,'clients');
 await p.locator('[data-delete-client="synthetic-a"]').click();
 await p.locator('#modalRoot.show').getByRole('button',{name:'刪除',exact:true}).click();
 await toast(p,'此客戶仍有案件');
 assert.equal(await p.locator('[data-delete-client="synthetic-a"]').count(),1);

 const old=structuredClone(current);
 old.backupVersion=7;
 delete old.data.cases;
 await nav(p,'backup');
 await upload(p,old);
 await p.locator('#restoreMergeBtn').click();
 await p.locator('#modalRoot.show').getByRole('button',{name:'合併',exact:true}).click();
 await toast(p,'合併完成');
 assert.equal((await h.backup(p)).data.cases.length,1);
 const invalid=structuredClone(current);
 invalid.data.cases[0].clientId='unavailable-client';
 await upload(p,invalid);
 await p.locator('#restoreMergeBtn').click();
 await toast(p,'有效客戶');
 assert.equal(await p.locator('#modalRoot.show').count(),0);
 await upload(p,old);
 await p.locator('#restoreOverwriteBtn').click();
 await h.download(p,()=>p.locator('#modalRoot.show').getByRole('button',{name:'繼續',exact:true}).click());
 await p.locator('#modalRoot.show').getByRole('button',{name:'確認已保存並覆蓋'}).click();
 await toast(p,'完整還原完成');
 const restored=await h.backup(p);
 assert.equal(restored.data.cases.length,0);
 assert.deepEqual(restored.data.clients.map(row=>row.id),current.data.clients.map(row=>row.id));
}

async function upgrade(p,h){
 const data=(await h.backup(p)).data;
 await p.evaluate(async snapshot=>{
  const name='VAT_WORKBENCH_DB';
  await new Promise((resolve,reject)=>{
   const request=indexedDB.deleteDatabase(name);
   request.onsuccess=resolve;
   request.onerror=()=>reject(request.error);
  });
  await new Promise((resolve,reject)=>{
   const request=indexedDB.open(name,3);
   request.onupgradeneeded=()=>{
    for(const [store,rows] of Object.entries(snapshot)){
     if(store==='cases')continue;
     const table=request.result.createObjectStore(store,{keyPath:'id'});
     for(const row of rows)table.put(row);
    }
   };
   request.onerror=()=>reject(request.error);
   request.onsuccess=()=>{request.result.close();resolve();};
  });
 },data);
 await h.reload(p);
 const result=await h.backup(p);
 assert.equal(result.backupVersion,8);
 assert.deepEqual(result.data.cases,[]);
 assert.deepEqual(result.data.clients.map(row=>row.id),data.clients.map(row=>row.id));
 assert.deepEqual(result.data.periodClients.map(row=>row.id),data.periodClients.map(row=>row.id));
 await create(p,false);
 assert.equal((await h.backup(p)).data.cases.length,1);
}
module.exports={lifecycle,backupAndReferences,upgrade};
