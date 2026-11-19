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
 assert.match(await page.locator('#contractClientPreview220').innerText(),/合成聯絡人[\s\S]*合成測試地址/);
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
 assert.match(await page.locator('#contractsList220 .folder-contact222').innerText(),/合成聯絡人/);
 assert.match(await row.innerText(),/核對合成續租資料[\s\S]*這是完整備註/);
 await h.screenshot(page,'vat-contracts-list-desktop');
 await nav(page,'today');
 const strip=page.locator('#contractReminderStrip220');
 assert(!await strip.isVisible());
 await page.clock.setFixedTime(formatDate(2026,10,30));
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await strip.waitFor();
 assert.match(await strip.innerText(),/核對合成續租資料/);
 await page.locator('#todaySystemTab210').click();
 await page.locator('#todayTodos [data-open-contract220]').waitFor();
 await page.locator('#todayWorkTab210').click();
 await strip.getByRole('button',{name:'完成待辦'}).click();
 await waitToast(page,'合約待辦已完成');
 assert(!await strip.isVisible());
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
 assert(!await strip.isVisible());
 const backup=await h.backup(page);
 assert.equal(backup.backupVersion,10);
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
  const child=first.getByRole('listitem');
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
  const lastChild=folders.first().getByRole('listitem');
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
 await page.locator('#contractStatusFilter220').selectOption('closed');
 assert.equal(await page.locator('[data-contract-id220]').count(),1);
 assert.match(await page.locator('#contractsList220 .folder-count222').innerText(),/1 \/ 14 合約/);
 await page.locator('#contractStatusFilter220').selectOption('all');
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
 await nav(page,'today');await strip.waitFor();await nav(page,'contracts');
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
 assert(!await strip.isVisible(),'Source reminder is suppressed during renewal');
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
 await oldRow().getByRole('button',{name:'查看合約',exact:true}).click();
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#deleteContract220').click();
 await page.locator('#contractError220').waitFor();
 assert.match(await page.locator('#contractError220').innerText(),/下一期/);
 await page.locator('#cancelContract220').click();
 await page.locator('[data-contract-id220="'+next+'"]').getByRole('button',{name:'查看合約',exact:true}).click();
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#deleteContract220').click();
 await waitToast(page,'已刪除合約');
 assert.equal(await all.count(),1);
 assert.match(await oldRow().innerText(),/即將到期/);
 await oldRow().getByRole('button',{name:'查看合約',exact:true}).click();
 await field(page,'closed').check();
 await page.locator('#saveContract220').click();
 await waitToast(page,'合約已儲存');
 await oldRow().getByRole('button',{name:'續約',exact:true}).click();
 assert.equal(await field(page,'startDate').inputValue(),'2026-12-01');
}

module.exports={lifecycle,lists,renewal};
