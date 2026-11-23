'use strict';
const assert=require('node:assert/strict');
const nav=(p,view)=>p.locator(`.nav-btn[data-view="${view}"]`).click();
const dbNames=p=>p.evaluate(async()=> (await indexedDB.databases()).map(info=>info.name));
const sampleDBs=async p=>(await dbNames(p)).filter(name=>name.startsWith('VAT_WORKBENCH_DB_SAMPLE_'));
async function ready(p,view,label){
 await p.locator(`#view-${view}.active #vatSampleIndicator`).filter({hasText:label}).waitFor({timeout:80000});
 await p.locator('.vat-sample-progress').waitFor({state:'detached',timeout:80000});
}
async function choose(p,size){
 await p.locator('#vatSampleLaunch').click();
 await p.locator(`[data-vat-sample-choice="${size}"]`).click();
}
async function samples(p,h){
 const before=await h.backup(p);
 assert.equal(before.data.clients.length,2);
 assert.equal(before.sampleTier,undefined);
 const preference=await p.evaluate(()=>localStorage.getItem('vatCurrentPeriod'));
 await nav(p,'work');
 await p.locator('[data-work-focus="notes"]').click();
 await p.locator('#wNotes').fill('SYNTHETIC UNSAVED FORMAL DRAFT');
 const popupPromise=p.context().waitForEvent('page');
 await choose(p,'small');
 const sample=await popupPromise;
 try{
  await ready(sample,'work','少量');
  assert.equal(await p.locator('#wNotes').inputValue(),'SYNTHETIC UNSAVED FORMAL DRAFT');
  assert.equal(await p.locator('#vatSampleIndicator').count(),0);
  assert.match(await sample.locator('#workDetail').innerText(),/樣本001/);
  assert.equal(await sample.evaluate(()=>window.OFFLINE_REVIEW_CONFIG.appId),'vat-workbench-sample');
  assert.equal(await p.evaluate(()=>window.OFFLINE_REVIEW_CONFIG.appId),'vat-workbench');

  const initialDBs=await sampleDBs(sample);
  assert.equal(initialDBs.length,1);
  const normalTheme=await p.locator('html').getAttribute('data-theme');
  await sample.locator('#themeBtn').click();
  await sample.waitForFunction(theme=>document.documentElement.dataset.theme!==theme,normalTheme);
  assert.equal(await p.locator('html').getAttribute('data-theme'),normalTheme);
  await sample.locator('#dateModeBtn').click();
  await sample.waitForFunction(()=>localStorage.getItem('vatSample:vatDateMode')==='roc');
  assert.equal(await p.evaluate(()=>localStorage.getItem('vatDateMode')),null);
  await sample.locator('#dateModeBtn').click();
  const annotation=sample.locator('#offline-review-host');
  await annotation.getByRole('button',{name:'修改標註',exact:true}).click();
  await annotation.locator('select').selectOption('0');
  await annotation.locator('textarea').fill('SYNTHETIC SAMPLE UI FEEDBACK');
  await annotation.getByRole('button',{name:'儲存標註',exact:true}).click();
  await annotation.getByRole('button',{name:'結束標註',exact:true}).click();
  const sampleNotes=await sample.evaluate(()=>localStorage.getItem('offline-review:1:vat-workbench-sample'));
  assert.match(sampleNotes,/SYNTHETIC SAMPLE UI FEEDBACK/);
  assert.equal(await p.evaluate(()=>localStorage.getItem('offline-review:1:vat-workbench')),null);

  for(const [view,element,pattern] of [
   ['today','#taskResultCount210',/\d/],['calendar','#calendarGrid',/樣本/],
   ['cases','#casesCount219',/6 位客戶.*6 件案件/],['contracts','#contractCount220',/6 位客戶.*6 筆合約/],
   ['accounting','#accountingClientList',/樣本001/],['clients','#clientTable',/DEMO-001/],
   ['templates','#templateEditorCard',/樣本通知/],['pdf','#pdfPeriod',/進行中/],
   ['backup','#backupSummary',/客戶 6/],['settings','#courierSettings',/刪除/]
  ]){
   await nav(sample,view);
   if(view==='cases')await sample.locator('#casesStatus219').selectOption('all');
   assert(await sample.locator(`#view-${view}.active #vatSampleLaunch`).isVisible(),view+' provides the sample entry');
   const content=element==='#templateEditorCard'?await sample.locator('#templatePreview').inputValue():await sample.locator(element).textContent();
   assert.match(content,pattern,view+' · '+content.slice(0,180));
  }
  await nav(sample,'work');
  await sample.locator('[data-work-focus="notes"]').click();
  await sample.locator('#wNotes').fill('SYNTHETIC SAVED SAMPLE EDIT');
  await sample.locator('#saveWorkBtn').click();
  await sample.locator('.toast').filter({hasText:'已儲存；'}).last().waitFor();
  const demoBackup=await h.backup(sample);
  assert.equal(demoBackup.sampleTier,'small');
  assert.equal(demoBackup.data.clients.length,6);
  assert(demoBackup.data.periodClients.some(row=>row.notes==='SYNTHETIC SAVED SAMPLE EDIT'));
  assert(demoBackup.data.notifications.every(row=>row.periodClientId.startsWith(row.periodId+'::sample-client-')));
  assert(demoBackup.data.periodClients.some(row=>row.taxAmount<0));
  assert(demoBackup.data.contracts.some(row=>row.lease?.steps.length>1));
  assert.equal(await p.evaluate(()=>localStorage.getItem('vatCurrentPeriod')),preference);

  p.once('dialog',dialog=>dialog.accept()); // Leave the formal form only for the import check.
  await nav(p,'backup');
  await p.locator('#restoreFile').setInputFiles({name:'sample.taxbackup',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(demoBackup))});
  await p.locator('#restoreMergeBtn').click();
  await p.locator('.toast').filter({hasText:'測試樣本備份請在樣本模式內匯入'}).waitFor();
  assert.deepEqual((await h.backup(p)).data,before.data);

  for(const [tier,label,count] of [['medium','中量',30],['large','大量',120]]){
   await nav(sample,'contracts');
   const previous=(await sampleDBs(sample)).at(-1);
   await choose(sample,tier);
   await ready(sample,'contracts',label);
   assert.equal(await sample.evaluate(()=>localStorage.getItem('offline-review:1:vat-workbench-sample')),sampleNotes);
   assert.notEqual(await sample.locator('html').getAttribute('data-theme'),normalTheme);
   assert.match(await sample.locator('#contractCount220').innerText(),new RegExp(count+' 位客戶'));
   assert(await sample.locator('#contractPagination220 select').isVisible());
   await sample.waitForFunction(async name=>!(await indexedDB.databases()).some(db=>db.name===name),previous);
   if(tier==='large'){
    const group=sample.locator('#contractsList220 [data-client-folder222="sample-client-001"]');
    await group.locator('summary').click();
    const records=group.locator('[data-contract-id220]');
    await records.first().waitFor();
    assert.equal(await records.count(),12);
    await group.locator('[data-folder-more222]').click();
    assert.equal(await records.count(),16);
    await sample.setViewportSize({width:320,height:800});
    assert(await sample.locator('#view-contracts').evaluate(view=>view.scrollWidth<=view.clientWidth+1));
    await h.screenshot(sample,'vat225-large-samples-mobile');
   }
  }
  const last=(await sampleDBs(sample)).at(-1);
  await sample.locator('#vatSampleExit').click();
  await sample.waitForFunction(()=>document.querySelector('#view-contracts.active #vatSampleLaunch')&&!document.documentElement.dataset.vatSample);
  assert.equal(await sample.evaluate(()=>window.OFFLINE_REVIEW_CONFIG.appId),'vat-workbench');
  assert.deepEqual((await h.backup(sample)).data,before.data);
  await sample.waitForFunction(async name=>!(await indexedDB.databases()).some(db=>db.name===name),last);
 }finally{await sample.close();}
}
module.exports=samples;
