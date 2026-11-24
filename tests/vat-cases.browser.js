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
 assert.match(await p.locator('#caseClient219 option:checked').innerText(),/合成/);
 assert.doesNotMatch(await form(p).innerText(),/合成聯絡人|合成測試地址/);
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
 await p.locator('#casesCards219 [data-record-toggle222]').click();
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
 assert.equal(current.backupVersion,11);
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
 delete old.data.contracts;
 delete old.data.contractCategories;
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
 await create(p,false);
 const data=(await h.backup(p)).data;
 await p.evaluate(async snapshot=>{
  const name='VAT_WORKBENCH_DB';
  await new Promise((resolve,reject)=>{
   const request=indexedDB.deleteDatabase(name);
   request.onsuccess=resolve;
   request.onerror=()=>reject(request.error);
  });
  await new Promise((resolve,reject)=>{
   const request=indexedDB.open(name,4);
   request.onupgradeneeded=()=>{
    for(const [store,rows] of Object.entries(snapshot)){
     if(['contracts','contractCategories','leaseRates'].includes(store))continue;
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
 assert.equal(result.backupVersion,11);
 assert.deepEqual(result.data.cases,data.cases);
 assert.deepEqual(result.data.contracts,[]);
 assert.deepEqual(result.data.contractCategories,[]);
 assert.deepEqual(result.data.clients.map(row=>row.id),data.clients.map(row=>row.id));
 assert.deepEqual(result.data.periodClients.map(row=>row.id),data.periodClients.map(row=>row.id));
 await nav(p,'cases');
 assert.equal(await p.locator('#casesCards219 [data-case-id219]').count(),1);
}

async function filtersAndEditor(p,h){
 await create(p,true);
 const backup=await h.backup(p),source=backup.data.cases[0];
 for(const [status,title,clientId] of [
  ['pending','合成待處理','synthetic-a'],['done','合成已完成','synthetic-a'],
  ['cancelled','樣本｜合成已取消','synthetic-b']
 ])backup.data.cases.push({...source,id:'filter-'+status,status,title,clientId,completedAt:status==='done'?source.updatedAt:''});
 await upload(p,backup);
 await p.locator('#restoreMergeBtn').click();
 await p.locator('#modalRoot.show').getByRole('button',{name:'合併',exact:true}).click();
 await toast(p,'合併完成');
 await nav(p,'cases');
 const select=p.locator('#casesStatus219'),client=p.locator('#casesClient219');
 const card=status=>p.locator(`#casesStats219 [data-record-status227="${status}"]`);
 const result=p.locator('#casesCount219');
 for(const status of ['pending','inProgress','done','cancelled']){
  await card(status).press('Space');
  assert.equal(await select.inputValue(),status);
  assert.equal(await card(status).getAttribute('aria-pressed'),'true');
  assert(await card(status).evaluate(el=>document.activeElement===el&&el.matches(':focus-visible')));
  assert.match(await result.innerText(),/1 件案件/);
 }
 const cancelled=p.locator('[data-case-id219="filter-cancelled"]');
 assert.match(await cancelled.innerText(),/樣本｜合成已取消/,'Custom formal titles are preserved');
 await card('cancelled').click();
 assert.equal(await select.inputValue(),'active');
 assert.equal(await card('cancelled').getAttribute('aria-pressed'),'false');
 assert.match(await result.innerText(),/2 件案件/);
 await client.selectOption('synthetic-a');
 assert.equal(await card('cancelled').locator('strong').innerText(),'0');
 await p.locator('#casesSearch219').fill('合成案件');
 assert.equal(await card('pending').locator('strong').innerText(),'0');
 await card('inProgress').click();
 await h.screenshot(p,'vat227-case-filter-desktop');
 const editor=p.locator('#casesCards219 [data-open-case219]');
 await editor.click();
 assert.equal(await p.locator('#modalRoot .modal-title').innerText(),'編輯案件');
 const reminder=p.locator('#caseReminder219'),fields=p.locator('#caseReminderFields219');
 assert(await fields.isVisible());
 const expandedHeight=(await form(p).boundingBox()).height;
 await reminder.uncheck();
 assert(!await fields.isVisible());
 assert((await form(p).boundingBox()).height<expandedHeight);
 await reminder.check();
 assert.equal(await p.locator('#caseReminderDate219').inputValue(),'2026-10-31');
 assert.equal(await p.locator('#caseReminderTime219').inputValue(),'09:00');
 for(const width of [390,320]){
  await p.setViewportSize({width,height:800});
  assert(await p.locator('.cases-modal219').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 }
 await reminder.uncheck();
 await h.screenshot(p,'vat227-case-editor-mobile');
 await reminder.check();
 await p.locator('#caseCancel219').click();
 assert(await editor.evaluate(el=>document.activeElement===el));
}
async function progressAndPrint(p,h){
 const scope=p.locator('#pdfScope'),paper=p.locator('#pdfPaper217'),font=p.locator('#pdfFont217');
 await nav(p,'pdf');
 await scope.selectOption('cases');
 assert(await p.locator('#pdfPeriodField').isHidden());
 assert.equal(await paper.locator('.pdf-title').textContent(),'案件進度清單');
 assert.match(await paper.innerText(),/沒有符合條件/);
 await font.selectOption('11');
 await p.locator('#pdfSave217').click();
 await p.locator('#pdfDirectStatus217').filter({hasText:'版面已儲存'}).waitFor();

 await create(p,false);
 await openEditor(p);
 await p.locator('.case-progress-editor232 summary').click();
 const stage=p.locator('[data-progress-stage]'),date=p.locator('[data-progress-date]');
 async function add(day,name){
  await p.locator('#caseProgressAdd232').click();
  await date.last().fill(day);
  await stage.last().fill(name);
 }
 await add('2026-10-31','第一批送件');
 await add('2026-10-30','備齊文件');
 await p.locator('[data-progress-note]').last().fill('合成進度說明');
 await p.setViewportSize({width:320,height:844});
 assert(await p.locator('.cases-modal219').evaluate(node=>node.scrollWidth<=node.clientWidth+1));
 await stage.last().scrollIntoViewIfNeeded();
 await h.screenshot(p,'vat232-case-progress-mobile');
 await p.setViewportSize({width:1440,height:1000});
 await save(p);
 await openEditor(p);
 assert.deepEqual(await stage.evaluateAll(nodes=>nodes.map(node=>node.value)),['第一批送件','備齊文件']);
 await add('2026-10-31','');
 await p.locator('#caseSave219').click();
 await p.locator('#caseError219').waitFor({state:'visible'});
 assert.match(await p.locator('#caseError219').textContent(),/第 3 筆進度階段/);
 await stage.last().fill('第二批送件');
 await save(p);
 assert.equal(await p.locator('.case-current-progress232').textContent(),'第二批送件');
 await p.locator('[data-record-toggle222]').click();
 assert.deepEqual(await p.locator('.case-progress-log232 li strong').allTextContents(),['備齊文件','第一批送件','第二批送件']);
 assert.equal((await h.backup(p)).data.cases[0].progress.length,3);
 await nav(p,'pdf');
 await scope.selectOption('cases');
 assert.equal(await font.inputValue(),'11');
 await p.locator('#pdfPeriod').evaluate(select=>select.value='');
 await p.locator('#pdfAdvanced217>summary').click();
 await p.locator('#pdfLayoutTab212').click();
 const caseHtml=await h.printCapture(p,'vat232-case-report',{heading:'案件進度清單',contains:['第二批送件']});
 assert.match(caseHtml,/第二批送件/);
 assert.match(caseHtml,/案件進度清單/);
 assert.doesNotMatch(caseHtml,/營業稅本期總表/);

 await nav(p,'contracts');
 await p.locator('#newContract220').click();
 await p.locator('#contract-clientId220').selectOption('synthetic-b');
 await p.locator('#contract-title220').fill('合成新增租約');
 await p.locator('#contract-startDate220').fill('2026-11-01');
 await p.locator('#contract-endDate220').fill('2027-10-31');
 await p.locator('#contract-monthlyRent220').fill('10,000');
 await p.locator('#contract-deposit220').fill('30,000');
 await p.locator('#saveContract220').click();
 await p.locator('#contractForm220').waitFor({state:'detached'});
 await nav(p,'pdf');
 await scope.selectOption('contracts');
 assert.equal(await font.inputValue(),'9','The case layout does not alter the contract layout');
 assert.match(await paper.innerText(),/合成新增租約/);
 await p.locator('#pdfRecordClient232').selectOption('synthetic-a');
 assert.match(await paper.innerText(),/沒有符合條件/);
 await p.locator('#pdfRecordClient232').selectOption('synthetic-b');
 assert.equal(await paper.locator('.pdf-title').textContent(),'租約與合約清單');
 assert.match(await paper.innerText(),/10,000 元.*30,000 元/s);
 await h.screenshot(p,'vat232-contracts-print-desktop');
 const contractHtml=await h.printCapture(p,'vat232-contract-report',{heading:'租約與合約清單',contains:['合成新增租約','30,000 元']});
 assert.match(contractHtml,/合成新增租約/);
 assert.doesNotMatch(contractHtml,/合成案件|營業稅本期總表/);
 await scope.selectOption('period');
 assert(await p.locator('#pdfPeriodField').isVisible());
 assert(await p.locator('#pdfRecordClientField232').isHidden());
 await p.locator('#pdfPeriod').selectOption('2026-1');
 assert.equal(await paper.locator('.pdf-title').first().textContent(),'營業稅本期總表');
}
module.exports={lifecycle,backupAndReferences,upgrade,filtersAndEditor,progressAndPrint};
