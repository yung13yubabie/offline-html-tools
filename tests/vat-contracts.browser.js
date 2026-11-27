'use strict';
const assert=require('node:assert/strict');
const nav=(page,view)=>page.locator('.nav-btn[data-view="'+view+'"]').click();
const field=(page,name)=>page.locator('#contract-'+name+'220');
const waitToast=(page,content)=>page.locator('.toast').filter({hasText:content}).last().waitFor();
const formatDate=(year,month,day)=>new Date(year,month-1,day,12);
async function createContract(page){
 await nav(page,'contracts');
 await page.locator('#newContract220').click();
 await field(page,'title').fill('合成辦公室租用');
 await field(page,'clientId').selectOption('synthetic-a');
 assert.match(await field(page,'clientId').locator('option:checked').innerText(),/合成/);
 assert.doesNotMatch(await page.locator('#contractForm220').innerText(),/合成聯絡人|合成測試地址/);
 await field(page,'categoryId').selectOption('__new');
 await field(page,'categoryName').fill('合成場地租用');
 await field(page,'startDate').fill('2026-04-01');
 await field(page,'endDate').fill('2026-11-30');
 await field(page,'task').fill('核對合成續租資料');
 await field(page,'note').fill('兩行合成內容\n這是完整備註');
 assert.match(await page.locator('#contractPreviewDate220').innerText(),/2026\/10\/30/);
 await field(page,'reminderEnabled').uncheck();
 assert(!await page.locator('#contractReminderFields222').isVisible());
 assert.equal(await page.locator('#contractPreviewDate220').innerText(),'');
 await field(page,'reminderEnabled').check();
 assert.equal(await field(page,'task').inputValue(),'核對合成續租資料');
 await page.locator('#saveContract220').click();
 await page.locator('#contractForm220').waitFor({state:'detached'});
 await waitToast(page,'合約已儲存');
}

async function lifecycle(page,h){
 await page.clock.setFixedTime(formatDate(2026,10,29));
 await createContract(page);
 const row=page.locator('#contractsList220 [data-contract-id220]');
 const id=await row.getAttribute('data-contract-id220');
 assert.match(await row.innerText(),/合成場地租用[\s\S]*有效/);
 await row.locator('[data-record-toggle222]').click();
 assert.deepEqual(await row.locator('.record-timeline224 li div span').allTextContents(),['開始','提醒','到期']);
 assert.match(await page.locator('#contractsList220 .folder-contact222').innerText(),/合成聯絡人/);
 assert.match(await row.innerText(),/核對合成續租資料[\s\S]*這是完整備註/);
 await h.screenshot(page,'vat-contracts-list-desktop');
 await nav(page,'today');
 const strip=page.locator('#contractReminderStrip220');
 assert.equal(await strip.locator('[data-contract-complete220]').count(),0);
 await page.clock.setFixedTime(formatDate(2026,10,30));
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await strip.locator('[data-contract-complete220]').waitFor();
 assert.match(await strip.innerText(),/合成辦公室租用/);
 await page.locator('#todaySystemTab210').click();
 await page.locator('#todayTodos [data-open-contract220]').waitFor();
 await page.locator('#todayWorkTab210').click();
 await strip.getByRole('button',{name:'完成待辦'}).click();
 await waitToast(page,'合約待辦已完成');
 assert.equal(await strip.locator('[data-contract-complete220]').count(),0);
 await nav(page,'contracts');
 await page.locator('#contractStatusFilter220').selectOption('upcoming');
 assert.equal(await row.count(),1);
 assert.match(await row.innerText(),/即將到期[\s\S]*待辦已完成/);
 const details=row.locator('[data-record-toggle222]');
 if(await details.getAttribute('aria-expanded')!=='true')await row.locator('[data-record-toggle222]').click();
 await row.getByRole('button',{name:'重開待辦'}).click();
 await waitToast(page,'合約待辦已重開');
 await nav(page,'calendar');
 await page.locator('#calendarListTab').click();
 const list=page.locator('#calendarList');
 assert.equal(await list.locator('[data-contract-calendar-item220]').count(),2);
 assert.match(await list.innerText(),/合約提醒.*合成辦公室租用/);
 assert.match(await list.innerText(),/合約到期.*合成辦公室租用/);
 await list.locator('[data-contract-calendar-item220]').first().getByRole('button',{name:'查看合約'}).click();
 assert.equal(await field(page,'title').inputValue(),'合成辦公室租用');
 await page.setViewportSize({width:390,height:844});
 assert(await page.locator('.contract-modal220').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
 await h.screenshot(page,'vat-contracts-edit-mobile');
 await page.setViewportSize({width:1440,height:1000});
 await field(page,'closed').check();
 await page.locator('#saveContract220').click();
 await waitToast(page,'合約已儲存');
 await nav(page,'today');
 assert.equal(await strip.locator('[data-contract-complete220]').count(),0);
 const backup=await h.backup(page);
 assert.equal(backup.backupVersion,11);
 assert.equal(backup.data.contracts[0].id,id);
 assert(backup.data.contracts[0].closed);
 assert.equal(backup.data.contractCategories[0].name,'合成場地租用');
 assert.equal(backup.data.calendarNotes.length,1);
 await page.locator('#partialScope').selectOption('contracts');
 const partial=JSON.parse((await h.download(page,()=>page.locator('#partialExportBtn').click())).toString());
 assert.deepEqual(partial.data.clients.map(row=>row.id),['synthetic-a']);
 assert.equal(partial.data.contracts[0].id,id);
 assert.equal(partial.data.contractCategories[0].id,backup.data.contracts[0].categoryId);
 await page.locator('#partialScope').selectOption('period');
 const period=JSON.parse((await h.download(page,()=>page.locator('#partialExportBtn').click())).toString());
 assert.deepEqual(period.data.contracts,[]);
 await nav(page,'clients');
 await page.locator('[data-delete-client="synthetic-a"]').click();
 await page.locator('#modalRoot.show').getByRole('button',{name:'刪除',exact:true}).click();
 await waitToast(page,'此客戶仍有合約');
 assert.equal(await page.locator('[data-delete-client="synthetic-a"]').count(),1);
 await h.reload(page);
 await nav(page,'contracts');
 assert.match(await row.innerText(),/已結案/);
}

async function lists(page,h){
 const base=await h.backup(page),at='2026-10-01T00:00:00.000Z';
 const clients=Array.from({length:12},(_,i)=>({
  id:'folder-demo-'+i,code:'ZZ-'+String(i+1).padStart(2,'0'),name:'合成分組客戶 '+(i+1),address:'',contacts:[],createdAt:at,updatedAt:at
 }));
 const clientId=i=>i<14?'synthetic-a':clients[i-14].id;
 const contracts=Array.from({length:26},(_,i)=>({id:'demo-contract-'+String(i).padStart(2,'0'),version:1,revision:1,
  clientId:clientId(i),categoryId:'lease',title:'合成租約 '+i,startDate:'2026-01-01',endDate:'2027-12-31',
  closed:i===13,reminderEnabled:true,leadMonths:1,task:'續約確認',note:'第 '+i+' 筆完整合約備註',taskCompletedAt:'',createdAt:at,updatedAt:at}));
 const cases=Array.from({length:26},(_,i)=>({id:'demo-case-'+String(i).padStart(2,'0'),version:1,revision:1,clientId:clientId(i),
  title:'合成案件 '+i,status:'inProgress',startDate:'2026-01-01',dueDate:'2027-12-31',dueTime:'',reminderEnabled:i!==25,
  reminderDate:'2027-12-25',reminderTime:'09:00',note:i===25?'':'客戶內完整內容 '+i+'\n第二行文字',createdAt:at,updatedAt:at,
  completedAt:'',reminderCompletedAt:''}));
 await page.evaluate(async ({contracts,cases,clients})=>{
  const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('VAT_WORKBENCH_DB');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(['contracts','cases','clients'],'readwrite');
   for(const [store,rows] of Object.entries({contracts,cases,clients}))for(const row of rows)tx.objectStore(store).put(row);
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
  });db.close();
 },{contracts,cases,clients});
 await h.reload(page);
 for(const [view,selector] of [['contracts','#contractsList220'],['cases','#casesCards219']]){
  await nav(page,view);
  const list=page.locator(selector),folders=list.locator('[data-client-folder222]');
  const pager=page.locator('#view-'+view+' .record-pager220 select');
  assert.equal(await folders.count(),12,'Paginate clients');
  assert.equal(await list.getByRole('listitem').count(),0,'Collapsed folders render no record rows');
  const first=folders.first(),summary=first.locator(':scope > summary');
  assert.equal(await first.getAttribute('data-client-folder222'),'synthetic-a');
  assert.match(await summary.innerText(),view==='contracts'?/14 合約[\s\S]*14 案件/:/14 案件[\s\S]*14 合約/);
  await summary.press('Enter');
  const child=first.locator('.record-item220');
  await child.first().waitFor();
  assert.equal(await child.count(),12);
  assert.equal(await first.locator('.folder-contact222').count(),1);
  await first.getByRole('button',{name:'再顯示 2 筆'}).click();
  assert.equal(await child.count(),14,'All child records stay in the same folder');
  await child.last().locator('[data-record-toggle222]').click();
  assert.match(await child.last().innerText(),view==='contracts'?/第 13 筆完整合約備註/:/客戶內完整內容 13[\s\S]*第二行文字/);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await summary.evaluate(el=>getComputedStyle(el,'::before').transitionDuration),'0s');
  await pager.selectOption('2');
  assert.equal(await folders.count(),1);
  assert.equal(await folders.first().getAttribute('data-client-folder222'),'folder-demo-11');
  await folders.first().locator(':scope > summary').press('Space');
  const lastChild=folders.first().locator('.record-item220');
  await lastChild.waitFor();
  if(view==='cases'){
   await lastChild.locator('[data-record-toggle222]').click();
   assert.equal(await lastChild.locator('.record-note222').count(),0);
   assert(!/提醒/.test(await lastChild.locator('.record-detail-body222').innerText()));
   assert.equal(await folders.first().locator('.folder-contact222').count(),0);
  }
  await pager.selectOption('1');
  await child.last().waitFor();
  assert.equal(await child.last().locator('[data-record-toggle222]').getAttribute('aria-expanded'),'true','Child expansion survives paging');
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});
   const active=page.locator('#view-'+view);
   await page.waitForFunction(()=>document.getAnimations().every(animation=>
    animation.playState!=='running'||!Number.isFinite(animation.effect?.getComputedTiming().endTime)));
   assert(await active.evaluate(panel=>panel.scrollWidth<=panel.clientWidth+1),view+' overflows at '+width+'px');
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  await first.scrollIntoViewIfNeeded();
  await h.screenshot(page,'vat-'+view+'-folders-mobile');
  await page.setViewportSize({width:1440,height:1000});
 }
 await nav(page,'contracts');
 const closed=page.locator('#contractStats220 [data-record-status227="closed"]');
 await closed.press('Enter');
 assert.equal(await page.locator('#contractStatusFilter220').inputValue(),'closed');
 assert.equal(await closed.getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('[data-contract-id220]').count(),1);
 assert.match(await page.locator('#contractsList220 .folder-count222').innerText(),/1 \/ 14 合約/);
 await closed.click();
 assert.equal(await page.locator('#contractStatusFilter220').inputValue(),'all');
 await page.locator('#contractSearch220').fill('第 13 筆完整合約備註');
 assert.equal(await page.locator('[data-contract-id220]').count(),1);
 // v8 merge preserves the new independent records.
 base.backupVersion=8;
 delete base.data.contracts;
 delete base.data.contractCategories;
 await nav(page,'backup');
 await page.locator('#restoreFile').setInputFiles({name:'synthetic-v8.taxbackup',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(base))});
 await page.locator('#restoreMergeBtn').click();
 await page.locator('#modalRoot.show').getByRole('button',{name:'合併',exact:true}).click();
 await waitToast(page,'合併完成');
 assert.equal((await h.backup(page)).data.contracts.length,26);
}

async function renewal(page,h){
 await page.clock.setFixedTime(formatDate(2026,10,31));
 await createContract(page);
 const all=page.locator('#contractsList220 [data-contract-id220]');
 const source=await all.getAttribute('data-contract-id220');
 const oldRow=()=>page.locator('[data-contract-id220="'+source+'"]');
 const strip=page.locator('#contractReminderStrip220');
 await nav(page,'today');await strip.locator('[data-contract-complete220]').waitFor();await nav(page,'contracts');
 const peer=await page.context().newPage();
 try{
  await peer.clock.setFixedTime(formatDate(2026,10,31));
  await peer.goto(page.url());
  await nav(peer,'contracts');
  await peer.locator('[data-contract-renew221]').click();
  await oldRow().getByRole('button',{name:'續約',exact:true}).click();
  assert.equal(await field(page,'startDate').inputValue(),'2026-12-01');
  assert.equal(await field(page,'endDate').inputValue(),'2027-11-30');
  assert(await field(page,'clientId').isDisabled());
  await page.locator('#contractRenewTerm221').selectOption('2');
  assert.equal(await field(page,'endDate').inputValue(),'2028-11-30');
  await page.locator('#contractRenewTerm221').selectOption('');
  await field(page,'endDate').fill('2027-08-31');
  await field(page,'startDate').fill('2026-11-30');
  await page.locator('#saveContract220').click();
  const error=page.locator('[data-contract-field-error220=startDate]');
  await error.waitFor();
  assert.match(await error.innerText(),/晚於上期/);
  await field(page,'startDate').fill('2026-12-01');
  assert(!await error.isVisible());
  await h.screenshot(page,'vat-contract-renewal');
  await page.locator('#saveContract220').click();
  await waitToast(page,'續約已儲存');
  await peer.locator('#saveContract220').click();
  await peer.locator('#contractError220').waitFor();
  assert.match(await peer.locator('#contractError220').innerText(),/已續約/);
  assert.equal(await field(peer,'startDate').inputValue(),'2026-12-01');
 }finally{await peer.close();}
 assert.equal(await all.count(),2);
 const nextRow=all.filter({hasText:'未生效'});
 assert.equal(await nextRow.count(),1);
 const next=await nextRow.getAttribute('data-contract-id220');
 assert.match(await oldRow().innerText(),/已續約/);
 await page.locator('#contractYearFilter221').selectOption('2027');
 assert.equal(await all.count(),1);
 assert.equal(await all.getAttribute('data-contract-id220'),next);
 await page.locator('#contractClearFilter220').click();
 await page.locator('#contractStatusFilter220').selectOption('renewed');
 assert.equal(await all.count(),1);
 await oldRow().locator('[data-record-toggle222]').click();
 await oldRow().getByRole('button',{name:'查看續約'}).click();
 assert.equal(await field(page,'endDate').inputValue(),'2027-08-31');
 await page.locator('#cancelContract220').click();
 await nav(page,'today');
 assert.equal(await strip.locator(`[data-contract-complete220="${source}"]`).count(),0,'Source reminder is suppressed during renewal');
 assert.match(await strip.innerText(),/目前沒有合約提醒/);
 await nav(page,'calendar');await page.locator('#calendarListTab').click();
 assert.equal(await page.locator('[data-contract-calendar-item220="contract-reminder:'+source+'"]').count(),0);
 assert.equal(await page.locator('[data-contract-calendar-item220="contract-reminder:'+next+'"]').count(),1);
 const backup=await h.backup(page);
 assert.equal(backup.data.contracts.find(row=>row.id===next).previousContractId,source);
 assert.equal(backup.data.contracts.find(row=>row.id===source).endDate,'2026-11-30');
 await page.locator('#partialScope').selectOption('contracts');
 const partial=JSON.parse((await h.download(page,()=>page.locator('#partialExportBtn').click())).toString());
 assert.equal(partial.data.contracts.length,2);
 await h.reload(page);
 await nav(page,'contracts');
 assert.match(await oldRow().innerText(),/已續約/);
 await oldRow().getByRole('button',{name:'管理合約',exact:true}).click();
 assert.equal(await page.locator('#modalRoot .modal-title').innerText(),'管理合約');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#deleteContract220').click();
 await page.locator('#contractError220').waitFor();
 assert.match(await page.locator('#contractError220').innerText(),/下一期/);
 await page.locator('#cancelContract220').click();
 await page.locator('[data-contract-id220="'+next+'"]').getByRole('button',{name:'管理合約',exact:true}).click();
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#deleteContract220').click();
 await waitToast(page,'已刪除合約');
 assert.equal(await all.count(),1);
 assert.match(await oldRow().innerText(),/即將到期/);
 await oldRow().getByRole('button',{name:'管理合約',exact:true}).click();
 await field(page,'closed').check();
 await page.locator('#saveContract220').click();
 await waitToast(page,'合約已儲存');
 await oldRow().getByRole('button',{name:'續約',exact:true}).click();
 assert.equal(await field(page,'startDate').inputValue(),'2026-12-01');
}

async function batchLeases(page,h){
 await nav(page,'contracts');
 await page.locator('#newLeaseBatch228').click();
 const form=page.locator('#leaseBatchForm228'),save=page.locator('#leaseBatchSave228');
 const common=key=>form.locator(`[name="${key}"]`);
 const rows=form.locator('.lease-batch-row228');
 const cell=(row,key)=>rows.nth(row).locator(`[data-batch-field="${key}"]`);
 await common('clientId').selectOption('synthetic-a');
 await common('categoryId').selectOption('other');
 await common('frequency').selectOption('3');
 await common('rentBasis').selectOption('gross');
 await common('regime').selectOption('assessed');
 await common('leadMonths').fill('0');
 await common('lessorName').fill('合成出租公司');
 for(const [key,value] of [['title','合成北區據點'],['startDate','2026-11-01'],['endDate','2027-10-31'],['rent','12,300.50'],['deposit','0']]){
  await cell(0,key).fill(value);
 }
 await cell(0,'rentalAddress').fill('合成北街 1 號');
 await rows.first().locator('[data-batch-copy]').click();
 assert.equal(await cell(1,'rent').inputValue(),'12,300.50');
 assert.equal(await cell(1,'rentalAddress').inputValue(),'合成北街 1 號');
 await cell(1,'title').fill('合成南區據點');
 await cell(1,'rentalAddress').fill('合成南街 1 號');
 await cell(1,'deposit').fill('24,500');
 await page.locator('#leaseBatchAdd228').click();
 assert.equal(await rows.count(),3);
 await rows.last().locator('[data-batch-remove]').click();
 await page.locator('#leaseBatchApply228').click();
 assert.match(await page.locator('#leaseBatchApplied228').innerText(),/2 列/);
 assert.match(await page.locator('.lease-batch-count228').innerText(),/2 筆/);
 await cell(1,'endDate').fill('2130-10-31');
 await save.click();
 const rowError=rows.nth(1).locator('p');
 await rowError.waitFor();
 assert.match(await rowError.innerText(),/第 2 列.*最多 100 年/);
 const peer=await page.context().newPage();
 try{
  await peer.goto(page.url());
  assert.deepEqual((await h.backup(peer)).data.contracts,[],'Invalid row aborts the entire transaction');
 }finally{await peer.close();}
 assert.equal(await cell(0,'title').inputValue(),'合成北區據點');
 await cell(1,'endDate').fill('2027-04-30');
 for(const width of [390,320]){
  await page.setViewportSize({width,height:800});
  assert(await page.locator('.lease-batch-modal228').evaluate(node=>node.scrollWidth<=node.clientWidth+1));
  assert(await save.evaluate(button=>button.getBoundingClientRect().bottom<=innerHeight));
 }
 await h.screenshot(page,'vat228-lease-batch-mobile');
 await page.setViewportSize({width:1440,height:1000});
 await h.screenshot(page,'vat228-lease-batch-desktop');
 await save.click();
 await waitToast(page,'已建立 2 筆租約');
 const folder=page.locator('#contractsList220 .folder-actions-wrap228');
 const batch=folder.locator('[data-lease-batch228]');
 assert.equal(await folder.locator('[data-contract-id220]').count(),2);
 assert.equal(await page.locator('#contractClientFilter220').inputValue(),'synthetic-a');
 await folder.locator('summary').first().click();
 assert(await batch.isVisible(),'Batch action is available even with the customer group collapsed');
 await batch.click();
 assert.equal(await common('clientId').inputValue(),'synthetic-a');
 await page.locator('.lease-batch-modal228').getByRole('button',{name:'取消',exact:true}).click();
 const backup=await h.backup(page);
 assert.equal(backup.data.contracts.length,2);
 for(const row of backup.data.contracts){
  assert.equal(row.clientId,'synthetic-a');
  assert.equal(row.categoryId,'other');
  assert.equal(row.leadMonths,0);
  assert.equal(row.reminderEnabled,true);
  assert.equal(row.lease.frequency,3);
  assert.equal(row.lease.rentBasis,'gross');
  assert.equal(row.lease.regime,'assessed');
  assert.equal(row.rental.kind,'company');
  assert.equal(row.rental.name,'合成出租公司');
  assert.equal(row.rental.address,row.title.endsWith('北區據點')?'合成北街 1 號':'合成南街 1 號');
  assert.equal(row.lease.steps[0].cents,1230050);
  assert.equal(row.lease.deposit,row.title.endsWith('北區據點')?0:2450000);
 }
}

async function rentReminders(page,h){
 await page.clock.setFixedTime(formatDate(2026,10,30));
 await nav(page,'contracts');
 await page.locator('#newContract220').click();
 await field(page,'title').fill('合成分段調租');
 await field(page,'clientId').selectOption('synthetic-a');
 await field(page,'startDate').fill('2026-10-01');
 await field(page,'endDate').fill('2027-02-28');
 await field(page,'monthlyRent').fill('10,000');
 await field(page,'reminderEnabled').uncheck();
 await page.locator('#saveContract220').click();
 await page.locator('#contractForm220').waitFor({state:'detached'});
 const row=page.locator('#contractsList220 [data-contract-id220]'),steps=page.locator('.lease-step224');
 const saveSteps=async()=>{
  await page.locator('#saveContract220').click();
  await page.locator('#saveContract220:not([disabled])').waitFor();
  assert(await page.locator('#leaseError224').isHidden());
  await page.locator('#cancelContract220').click();
  await page.locator('#contractForm220').waitFor({state:'detached'});
 };
 const editSteps=async()=>{
  await nav(page,'contracts');
  await row.locator('[data-open-contract220]').click();
  await page.locator('#lease-tab-setup').click();
 };
 const add=async(date,amount)=>{
  await page.locator('#leaseAddStep224').click();
  const step=steps.last();
  await step.locator('.lease-step-date').fill(date);
  await step.locator('.lease-step-rent').fill(amount);
  return step;
 };
 await editSteps();
 const rise=await add('2026-11-30','12,000');
 assert.equal(await rise.locator('[data-rent-reminder-days233]').inputValue(),'30');
 const fall=await add('2026-12-20','11,500');
 await fall.locator('[data-rent-reminder-toggle233]').uncheck();
 assert(await fall.locator('[data-rent-reminder-days233]').isHidden());
 await saveSteps();
 await row.locator('[data-record-toggle222]').click();
 const details=row.locator('.lease-changes233');
 assert.deepEqual(await details.locator('time').evaluateAll(nodes=>nodes.map(node=>node.dateTime)),['2026-11-30','2026-12-20']);
 assert.match(await details.innerText(),/10,000 元 → 12,000 元[\s\S]*租金調漲 \+2,000 元/);
 assert.match(await details.innerText(),/租金調降 −500 元[\s\S]*提醒關閉/);
 await page.setViewportSize({width:390,height:844});
 assert(await details.evaluate(node=>node.scrollWidth<=node.clientWidth+1));
 await details.scrollIntoViewIfNeeded();
 await h.screenshot(page,'vat233-rent-change-details-mobile');
 await page.setViewportSize({width:1440,height:1000});

 const strip=page.locator('#contractReminderStrip220'),confirm=strip.locator('[data-confirm-rent-change233]');
 await nav(page,'today');assert.equal(await confirm.count(),0);
 await page.clock.setFixedTime(formatDate(2026,10,31));
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await confirm.waitFor();
 assert.match(await strip.innerText(),/合成分段調租 · 租金調漲/);
 await page.locator('#todaySystemTab210').click();
 const system=page.locator('#todayTodos');
 assert.match(await system.innerText(),/10,000 元 → 12,000 元/);
 await system.locator('[data-open-rent-change233]').click();
 assert.equal(await page.locator('#lease-tab-setup').getAttribute('aria-selected'),'true');
 await page.locator('#cancelContract220').click();
 await system.locator('[data-confirm-rent-change233]').click();
 await waitToast(page,'調租提醒已確認');
 assert.equal(await confirm.count(),0);
 const data=await h.backup(page);
 assert(data.data.contracts[0].lease.steps[1].reminderDoneAt);
 assert.equal(data.data.contracts[0].lease.steps[2].remindDays,null);
 assert.equal(data.data.contracts[0].taskCompletedAt,'');
 await h.reload(page);
 await page.clock.setFixedTime(formatDate(2026,10,31));
 await nav(page,'today');assert.equal(await confirm.count(),0);

 await nav(page,'calendar');
 await page.locator('#calendarListTab').click();
 await page.locator('#calendarSource230').selectOption('contract');
 const list=page.locator('#calendarList'),alerts=list.locator('[data-contract-calendar-item220^="rent-reminder:"]');
 assert.equal(await alerts.count(),1);
 assert.match(await alerts.first().innerText(),/調租提醒已確認/);
 assert.equal(await list.locator('[data-contract-calendar-item220^="rent-effective:"]').count(),2);
 await editSteps();
 await steps.nth(1).locator('.lease-step-date').fill('2026-11-29');
 await steps.nth(1).locator('.lease-step-rent').fill('12,500');
 await saveSteps();
 await nav(page,'today');
 await confirm.waitFor();
 assert.equal(await confirm.getAttribute('data-rent-effective233'),'2026-11-29');
 await editSteps();
 await steps.nth(1).locator('[data-lease-remove-step]').click();
 await saveSteps();
 await nav(page,'today');assert.equal(await confirm.count(),0);
 await nav(page,'calendar');await page.locator('#calendarListTab').click();
 assert.equal(await alerts.count(),0);
 assert.equal(await list.locator('[data-contract-calendar-item220^="rent-effective:"]').count(),1);
}

async function renewalCostsAndReferences(page,h){
 await page.clock.setFixedTime(formatDate(2026,10,31));
 await nav(page,'contracts');
 await page.locator('#newContract220').click();
 await field(page,'title').fill('合成續租據點');
 await field(page,'clientId').selectOption('synthetic-a');
 await field(page,'startDate').fill('2026-04-01');
 await field(page,'endDate').fill('2026-11-30');
 await field(page,'monthlyRent').fill('10000');
 await field(page,'rentBasis').selectOption('gross');
 await field(page,'deposit').fill('30000');
 const form=page.locator('#contractForm220'),save=page.locator('#saveContract220'),steps=page.locator('.lease-step224');
 const close=()=>page.locator('#cancelContract220').click();
 const row=id=>page.locator('[data-contract-id220="'+id+'"]');
 const addStep=async(date,rent)=>{
  await page.locator('#leaseAddStep224').click();
  await steps.last().locator('.lease-step-date').fill(date);
  await steps.last().locator('.lease-step-rent').fill(rent);
 };
 await save.click();
 await waitToast(page,'合約已儲存');
 const source=await page.locator('[data-contract-id220]').getAttribute('data-contract-id220');
 await row(source).locator('[data-open-contract220]').click();
 await page.locator('#leaseFrequency224').selectOption('1');
 await page.locator('#lease-tab-setup').click();
 await page.locator('#leaseRentVatRate234').fill('3');
 await addStep('2026-08-01','12500.25');
 await save.click();
 await waitToast(page,'租約費用已儲存');
 await close();
 const original=(await h.backup(page)).data.contracts[0];
 // Existing filters and a long client folder must not obscure the new term.
 const fillers=Array.from({length:12},(_,i)=>({...original,id:'older-lease-'+i,title:'合成較早租約 '+i,lease:undefined,endDate:'2026-10-30'}));
 const writeRaw=rows=>page.evaluate(async data=>{
  const connection=await new Promise((resolve,reject)=>{
   const request=indexedDB.open('VAT_WORKBENCH_DB');
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
  try{
   await new Promise((resolve,reject)=>{
    const transaction=connection.transaction('contracts','readwrite');
    for(const row of data)transaction.objectStore('contracts').put(row);
    transaction.oncomplete=resolve;
    transaction.onabort=()=>reject(transaction.error);
   });
  }finally{connection.close();}
 },rows);
 await writeRaw(fillers);
 await h.reload(page);
 await nav(page,'contracts');
 await page.locator('#contractSearch220').fill(original.title);
 await row(source).getByRole('button',{name:'續約',exact:true}).click();
 assert.equal(await field(page,'monthlyRent').inputValue(),'12500.25');
 assert.equal(await field(page,'deposit').inputValue(),'30000');
 assert.equal(await field(page,'rentBasis').inputValue(),'gross');
 await save.click();
 await waitToast(page,'續約已儲存');
 const renewal=page.locator('[data-contract-id220]').filter({hasText:'未生效'});
 const next=await renewal.getAttribute('data-contract-id220');
 await row(next).getByRole('button',{name:'管理合約',exact:true}).click();
 assert.equal(await page.locator('#leaseFrequency224').inputValue(),'1');
 assert.match(await form.innerText(),/上期合約.*合成續租據點/);
 await page.locator('#lease-tab-setup').click();
 assert.equal(await page.locator('#leaseRentVatRate234').inputValue(),'3');
 assert.equal(await steps.count(),1);
 assert.equal(await steps.first().locator('.lease-step-date').inputValue(),'2026-12-01');
 assert.equal(await steps.first().locator('.lease-step-rent').inputValue(),'12500.25');
 await addStep('2027-02-01','13200');
 await save.click();
 await waitToast(page,'租約費用已儲存');
 await close();
 let data=(await h.backup(page)).data;
 const current=data.contracts.find(contract=>contract.id===next);
 assert.equal(current.previousContractId,source);
 assert.equal(current.lease.deposit,3000000);
 assert.deepEqual(current.lease.steps.map(({from,cents})=>[from,cents]),[['2026-12-01',1250025],['2027-02-01',1320000]]);
 assert.deepEqual(current.lease.checks,[]);
 assert.deepEqual(data.contracts.find(contract=>contract.id===source),original);

 await page.clock.setFixedTime(formatDate(2027,2,1));
 await nav(page,'calendar');
 await page.locator('#calendarTodayBtn').click();
 await page.locator('[data-calendar-date="2027-02-01"]').click();
 await page.locator('#calendarDrawer [data-open-rent-change233="'+next+'"]').click();
 assert.equal(await page.locator('#lease-tab-setup').getAttribute('aria-selected'),'true');
 await close();
 await page.locator('#calendarDrawerClose').click();

 // Reproduce both legacy forms of incomplete linkage without weakening import validation.
 await writeRaw([{...current,lease:undefined},
  {...current,id:'broken-prior',title:'合成缺上期',previousContractId:'absent-prior'},
  {...original,id:'broken-client-a',title:'合成待連回客戶上期',clientId:'absent-client'},
  {...current,id:'broken-client-b',title:'合成待連回客戶本期',clientId:'absent-client',previousContractId:'broken-client-a'}]);
 await h.reload(page);
 await nav(page,'contracts');
 const manage=async(id,title,clientId='synthetic-a')=>{
  await page.locator('#contractSearch220').fill(title);
  const folder=page.locator('#contractsList220 [data-client-folder222="'+clientId+'"]');
  if(await folder.getAttribute('open')===null)await folder.locator(':scope > summary').click();
  await row(id).getByRole('button',{name:'管理合約',exact:true}).click();
 };
 await manage(next,current.title);
 await page.locator('#lease-tab-setup').click();
 assert.equal(await steps.first().locator('.lease-step-rent').inputValue(),'12500.25');
 await addStep('2027-03-01','13500');
 await save.click();
 await waitToast(page,'租約費用已儲存');
 await close();
 await manage('broken-prior','合成缺上期');
 await page.locator('#contractDetachPrevious237').check();
 await save.click();
 await form.waitFor({state:'detached'});
 await manage('broken-client-b','合成待連回客戶本期','absent-client');
 await field(page,'clientId').selectOption('synthetic-b');
 await save.click();
 await form.waitFor({state:'detached'});
 data=(await h.backup(page)).data;
 assert.equal(data.contracts.find(contract=>contract.id===next).lease.steps[1].cents,1350000);
 assert.equal(data.contracts.find(contract=>contract.id==='broken-prior').previousContractId,undefined);
 assert.deepEqual(data.contracts.find(contract=>contract.id==='broken-prior').lease,current.lease);
 assert.equal(data.contracts.find(contract=>contract.id==='broken-client-a').clientId,'synthetic-b');
 const relinked=data.contracts.find(contract=>contract.id==='broken-client-b');
 assert.equal(relinked.clientId,'synthetic-b');
 assert.equal(relinked.previousContractId,'broken-client-a');
}

async function landlordPayments(page,h){
 await page.clock.setFixedTime(formatDate(2026,11,1));
 await nav(page,'contracts');
 const save=page.locator('#saveContract220'),cancel=page.locator('#cancelContract220');
 const manage=title=>page.locator('[data-contract-id220]').filter({hasText:title}).getByRole('button',{name:'管理合約',exact:true}).click();
 const tab=key=>page.locator('#lease-tab-'+key);
 const pay=key=>page.locator('#leasePay'+key+'238');
 const rows=page.locator('[data-lease-pay-row238]');
 await page.locator('#newContract220').click();
 assert.equal(await field(page,'lessorKind').inputValue(),'company');
 await field(page,'title').fill('合成個人租約');
 await field(page,'clientId').selectOption('synthetic-a');
 await field(page,'lessorKind').selectOption('individual');
 await field(page,'lessorName').fill('合成房東');
 await field(page,'rentalAddress').fill('合成巷 20 號 3 樓');
 await field(page,'lessorContact').fill('合成聯絡方式');
 await field(page,'startDate').fill('2026-11-01');
 await field(page,'endDate').fill('2027-04-30');
 await field(page,'monthlyRent').fill('20000');
 await field(page,'deposit').fill('40000');
 assert(await field(page,'rentBasis').isHidden());
 assert(await page.locator('#contractDepositPreview232').isHidden());
 await save.click();
 await waitToast(page,'合約已儲存');
 await page.locator('#contractSearch220').fill('合成巷 20 號');
 await manage('合成個人租約');
 assert.equal(await field(page,'lessorName').inputValue(),'合成房東');
 assert.equal(await field(page,'lessorContact').inputValue(),'合成聯絡方式');
 await tab('deposit').click();
 assert.equal(await page.locator('#leaseDeposit224').inputValue(),'40000');
 assert(await page.locator('.lease-interest-preview232').isHidden());
 await tab('review').click();
 assert.equal(await tab('review').innerText(),'扣繳核對');
 assert(await page.locator('#leaseReviewLayout228').isHidden());
 await pay('New').click();
 await pay('Import').selectOption('2026-11-01/2026-11-30');
 assert.equal(await pay('Date').inputValue(),'');
 assert.equal(await pay('Amount').inputValue(),'20000');
 assert.match(await pay('TaxDue').innerText(),/0 元/);
 assert.match(await pay('NhiDue').innerText(),/422 元/);
 await pay('Apply').click();
 assert.match(await pay('Error').innerText(),/實際給付日|日期/);
 await pay('Date').fill('2026-11-03');
 await pay('TaxActual').fill('0');
 await pay('NhiActual').fill('420');
 await pay('Apply').click();
 assert.match(await rows.first().innerText(),/422 元[\s\S]+420 元[\s\S]+差 -2 元/);
 await pay('New').click();
 await pay('Date').fill('2027-01-02');
 await pay('Amount').fill('36000');
 await pay('Note').fill('一次支付兩月');
 assert.match(await pay('TaxDue').innerText(),/3,600 元/);
 assert.match(await pay('NhiDue').innerText(),/760 元/);
 await pay('NhiRule').selectOption('exempt');
 assert.match(await pay('NhiDue').innerText(),/0 元/);
 await pay('NhiRule').selectOption('standard');
 await page.setViewportSize({width:320,height:844});
 assert(await pay('Editor').evaluate(node=>node.scrollWidth<=node.clientWidth+1));
 await pay('Amount').scrollIntoViewIfNeeded();
 await h.screenshot(page,'vat238-individual-payment-mobile');
 await page.setViewportSize({width:1440,height:1000});
 await pay('Apply').click();
 await h.screenshot(page,'vat238-individual-review-desktop');
 await save.click();
 await waitToast(page,'租約費用已儲存');
 await cancel.click();
 let contracts=(await h.backup(page)).data.contracts;
 const current=contracts[0];
 assert.equal(current.rental.kind,'individual');
 assert.equal(current.rental.address,'合成巷 20 號 3 樓');
 assert.equal(current.lease.deposit,4_000_000);
 assert.deepEqual(current.leasePayments.map(row=>[row.amount,row.taxActual,row.nhiActual]),[[2_000_000,0,42_000],[3_600_000,null,null]]);
 await h.reload(page);
 await nav(page,'contracts');await manage('合成個人租約');
 await tab('review').click();
 await pay('Year').selectOption('2027');
 assert.equal(await rows.count(),1);
 assert.match(await rows.first().innerText(),/一次支付兩月/);
 await tab('basic').click();
 await field(page,'lessorKind').selectOption('company');
 await tab('review').click();
 assert(await page.locator('#leaseReviewLayout228').isVisible());
 assert(await page.locator('#leaseIndividualReview238').isHidden());
 await tab('basic').click();
 await field(page,'lessorKind').selectOption('individual');
 await tab('review').click();
 assert.equal(await rows.count(),1);
 await cancel.click();

 await page.locator('[data-contract-renew221]').click();
 assert.equal(await field(page,'lessorKind').inputValue(),'individual');
 assert.equal(await field(page,'rentalAddress').inputValue(),'合成巷 20 號 3 樓');
 await save.click();
 await waitToast(page,'續約已儲存');
 contracts=(await h.backup(page)).data.contracts;
 const next=contracts.find(row=>row.previousContractId===current.id);
 assert.deepEqual(next.rental,current.rental);
 assert.equal(next.leasePayments,undefined);
}

async function landlordBatchReview(page,h){
 await page.clock.setFixedTime(formatDate(2026,11,1));
 await nav(page,'contracts');
 const save=page.locator('#saveContract220'),cancel=page.locator('#cancelContract220');
 const pay=key=>page.locator('#leasePay'+key+'238');
 const tab=key=>page.locator('#lease-tab-'+key);
 const rows=page.locator('[data-lease-pay-row238]');
 const manage=()=>page.locator('[data-contract-id220]').filter({hasText:'合成批量個人租約'}).getByRole('button',{name:'管理合約',exact:true}).click();
 await page.locator('#newContract220').click();
 await field(page,'title').fill('合成批量個人租約');
 await field(page,'clientId').selectOption('synthetic-a');
 await field(page,'lessorKind').selectOption('individual');
 await field(page,'lessorResidency').selectOption('nonresident');
 await field(page,'lessorNhiRule').selectOption('special');
 await field(page,'lessorNhiMin').fill('29500');
 await field(page,'startDate').fill('2026-11-01');
 await field(page,'endDate').fill('2027-01-31');
 await field(page,'monthlyRent').fill('19000');
 await save.click();await waitToast(page,'合約已儲存');await manage();
 await tab('setup').click();
 await page.locator('#leaseAddStep224').click();
 await page.locator('.lease-step-date').last().fill('2026-12-01');
 await page.locator('.lease-step-rent').last().fill('30000');
 await tab('review').click();
 await pay('Monthly').locator('summary').click();
 const month=key=>page.locator('[data-pay-month239="'+key+'"]');
 assert.match(await month('2026-11').innerText(),/19,000 元[\s\S]+3,800 元[\s\S]+健保 0 元/);
 assert.match(await month('2026-12').innerText(),/30,000 元[\s\S]+6,000 元[\s\S]+633 元/);
 await month('2026-11').locator('input').fill('2026-11-04');
 await month('2026-12').locator('input').fill('2026-11-04');
 await pay('AddMonths').click();
 assert.match(await pay('BatchError').innerText(),/給付日重複/);
 assert.equal(await rows.count(),0);
 await month('2026-12').locator('input').fill('2026-12-07');
 await pay('AddMonths').click();
 assert.equal(await rows.count(),2);
 assert.equal(await month('2026-11').count(),0);
 assert.match(await rows.first().innerText(),/待核對/);
 const actual=(row,key)=>row.locator('[data-pay-actual239="'+key+'"]');
 await actual(rows.first(),'nhiActual').fill('630');
 await pay('SelectAll').check();
 await pay('Compare').click();
 assert.match(await rows.first().innerText(),/差 -3 元/);
 assert.equal(await actual(rows.first(),'taxActual').inputValue(),'');
 await pay('Fill').click();
 assert.equal(await actual(rows.first(),'nhiActual').inputValue(),'630');
 assert.equal(await actual(rows.first(),'taxActual').inputValue(),'6000');
 assert.equal(await actual(rows.last(),'nhiActual').inputValue(),'0');
 assert.equal(await actual(rows.last(),'taxActual').inputValue(),'3800');
 await page.setViewportSize({width:320,height:844});
 assert(await pay('List').evaluate(node=>node.scrollWidth<=node.clientWidth+1));
 await page.setViewportSize({width:1440,height:1000});
 await save.click();await waitToast(page,'租約費用已儲存');await cancel.click();
 await h.reload(page);await nav(page,'contracts');await manage();
 assert.equal(await field(page,'lessorNhiMin').inputValue(),'29500');
 await field(page,'lessorNhiRule').selectOption('exempt');
 await tab('review').click();
 assert.match(await rows.first().innerText(),/633 元[\s\S]+630 元/);
 await pay('New').click();
 assert.equal(await pay('Residence').inputValue(),'nonresident');
 assert.equal(await pay('NhiRule').inputValue(),'exempt');
 await pay('Cancel').click();
 await save.click();await waitToast(page,'租約費用已儲存');await cancel.click();
 const data=(await h.backup(page)).data.contracts.find(row=>row.title==='合成批量個人租約');
 assert.deepEqual(data.rental.withholding,{residency:'nonresident',nhiRule:'exempt'});
 assert.deepEqual(data.leasePayments.map(row=>[row.rentMonth,row.amount,row.nhiRule,row.taxActual,row.nhiActual]),
  [['2026-11',1_900_000,'special',380_000,0],['2026-12',3_000_000,'special',600_000,63_000]]);

 // Model a v2.38.0 legacy manual entry, paid early at a different amount.
 await nav(page,'contracts');await manage();await tab('review').click();await pay('New').click();
 await pay('Date').fill('2026-12-29');
 await pay('Amount').fill('28000');
 await pay('TaxActual').fill('5600');
 await pay('Apply').click();
 await pay('Monthly').locator('summary').click();
 await pay('MonthYear').selectOption('2027');
 await month('2027-01').locator('input').fill('2027-01-03');
 await pay('AddMonths').click();
 assert.match(await pay('BatchError').innerText(),/未指定月份的既有給付/);
 assert.equal(await rows.count(),3);
 await rows.first().locator('[data-pay-edit238]').click();
 assert.equal(await pay('RentMonth').inputValue(),'');
 await pay('RentMonth').selectOption('2027-01');
 assert.equal(await pay('Amount').inputValue(),'28000');
 await pay('Apply').click();
 assert.equal(await month('2027-01').count(),0);
 assert.equal(await rows.count(),3);
 await save.click();await waitToast(page,'租約費用已儲存');await cancel.click();
 const saved=(await h.backup(page)).data.contracts.find(row=>row.id===data.id);
 const early=saved.leasePayments.find(row=>row.rentMonth==='2027-01');
 assert.deepEqual([early.date,early.amount,early.taxActual],['2026-12-29',2_800_000,560_000]);
}

module.exports={lifecycle,lists,renewal,batchLeases,rentReminders,renewalCostsAndReferences,landlordPayments,landlordBatchReview};
