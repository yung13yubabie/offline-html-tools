const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../apps/vat-workbench.html'),'utf8'),ctx={};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('const NOTICE_TONE212='),source.indexOf('const NOTICE_GROUPS212='))+';globalThis.specs=NOTICE_SPECS212;',ctx);
const specs=JSON.parse(JSON.stringify(ctx.specs));
async function originals(p,{reload,backup,screenshot,download}){
 await p.evaluate(async specs=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('VAT_WORKBENCH_DB');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  await new Promise((resolve,reject)=>{const tx=db.transaction(['templates','settings'],'readwrite'),t=tx.objectStore('templates');
   for(const id of ['receiptAsk','dispatchReminder']){const s=specs.find(x=>x.id===id);t.put({id:'notice212_'+id,typeId:id,name:s.name+'・親切專業版',text:s.text,tone:'親切專業版',noticeBuiltin212:id,builtIn:true,enabled:true});}
   const s=specs.find(x=>x.id==='collectionTomorrow211');t.put({id:'collectionTomorrow211_default',typeId:s.id,name:s.name+'・親切專業版',text:s.text,tone:'親切專業版',noticeBuiltin212:s.id,builtIn:true,enabled:true,remindersEnabled:true,reminders:[{id:'keep-reminder',mode:'relative',base:'appointmentDate',days:1}]});
   t.put({id:'receiptAsk',typeId:'receiptAsk',name:'合成既有修改',text:'SYNTHETIC ORIGINAL CUSTOM {客戶}',builtIn:true,enabled:true,reminders:[]});
   t.put({id:'synthetic-custom-template',typeId:'receiptAsk',name:'合成自訂原稿',text:'SYNTHETIC CUSTOM PRESERVED {客戶}',tone:'原有測試語氣',builtIn:false,enabled:true,reminders:[]});
   const b=specs.find(x=>x.id==='firstBilling');t.put({id:'notice212_firstBilling',typeId:b.id,name:b.name+'・親切專業版',text:'SYNTHETIC EDITED COPY {客戶}',tone:'親切專業版',noticeBuiltin212:b.id,builtIn:true,enabled:true,reminders:[]});
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});db.close();
 },specs);
 await reload(p);await p.locator('.nav-btn[data-view="templates"]').click();assert.equal(await p.locator('#noticeToneFilter212,#templateTone212').count(),0);
 await p.locator('#noticeGroup212').selectOption('vat');assert.equal(await p.locator('#notificationTypeList [data-select-type]').count(),5);
 await p.locator('[data-select-type="receiptAsk"]').first().click();assert.equal(await p.locator('[data-select-template="notice212_receiptAsk"]').count(),0);
 await p.locator('[data-select-template="receiptAsk"]').click();assert.equal(await p.locator('#templateText').inputValue(),'SYNTHETIC ORIGINAL CUSTOM {客戶}');await p.locator('#noticeClient').selectOption('2026-1::synthetic-a');assert.match(await p.locator('#templatePreview').inputValue(),/合成測試客戶甲/);
 await p.locator('[data-template-tab="export"]').click();await p.locator('#exportTemplateClearBtn').click();await p.locator('.txt-template-choice[value="receiptAsk"]').check();await p.locator('#txtClients').selectOption('2026-1::synthetic-a');const txt=await download(p,()=>p.locator('#exportTxtBtn').click());assert.match(txt.toString(),/SYNTHETIC ORIGINAL CUSTOM 合成測試客戶甲/);
 await p.locator('[data-template-tab="manage"]').click();await p.locator('[data-select-template="synthetic-custom-template"]').click();await p.locator('#templateText').fill('SYNTHETIC SAVED {客戶}');await p.locator('#saveTemplateBtn').click();await p.locator('.toast').filter({hasText:'模板已儲存'}).last().waitFor();
 await screenshot(p,'vat213-original-notices-desktop');let b=await backup(p);assert(!b.data.templates.some(t=>['notice212_receiptAsk','notice212_dispatchReminder'].includes(t.id)));
 assert.equal(b.data.templates.find(t=>t.id==='receiptAsk').text,'SYNTHETIC ORIGINAL CUSTOM {客戶}');assert.equal(b.data.templates.find(t=>t.id==='synthetic-custom-template').tone,'原有測試語氣');
 const edited=b.data.templates.find(t=>t.id==='notice212_firstBilling');assert.equal(edited.text,'SYNTHETIC EDITED COPY {客戶}');assert.equal(edited.builtIn,false);assert(!edited.noticeBuiltin212);
 const collection=b.data.templates.find(t=>t.id==='collectionTomorrow211_default');assert.match(collection.text,/預計於/);assert.equal(collection.reminders[0].id,'keep-reminder');assert(!collection.noticeBuiltin212);
 assert.equal(b.data.notifications.find(n=>n.id==='synthetic-notice').content,'SYNTHETIC notification history');const count=b.data.templates.length;
 await reload(p);b=await backup(p);assert.equal(b.data.templates.length,count);assert.equal(b.data.templates.find(t=>t.id==='synthetic-custom-template').text,'SYNTHETIC SAVED {客戶}');
}
async function collection(p,{reload,backup,screenshot,download}){
 await p.clock.setFixedTime(new Date('2026-12-31T16:30:00Z'));
 const dates=await p.evaluate(async()=>{
  const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,today=fmt(new Date()),date=n=>{const d=new Date();d.setDate(d.getDate()+n);return fmt(d)};
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('VAT_WORKBENCH_DB');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}),read=store=>new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}),rows=await read('periodClients'),settings=(await read('settings'))[0],a=rows.find(x=>x.id==='2026-1::synthetic-a'),b=rows.find(x=>x.id==='2026-1::synthetic-b');
  a.appointmentDate=date(1);b.appointmentDate=date(2);const extra=[['c',{}],['complete',{receiptStatusId:settings.receiptStatuses.find(s=>s.complete).id}],['na',{notApplicable:true}],['other',{periodId:'2026-2'}]].map(([id,fields])=>({...a,id:'collection-'+id,clientId:'collection-'+id,snapshot:{...a.snapshot,name:'合成收票 '+id,code:'COL-'+id},...fields}));
  await new Promise((resolve,reject)=>{const tx=db.transaction('periodClients','readwrite');for(const pc of [a,b,...extra])tx.objectStore('periodClients').put(pc);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});db.close();return{today,one:date(1),two:date(2)};
 });
 await reload(p);await p.locator('.nav-btn[data-view="templates"]').click();await p.locator('[data-select-type="collectionTomorrow211"]').first().click();
 assert.equal(await p.locator('#collectionDays213').inputValue(),'1');assert((await p.locator('#collectionDate213').textContent()).includes(dates.one.replaceAll('-','/')));
 const ids=()=>p.locator('#noticeClient option').evaluateAll(es=>es.map(e=>e.value));assert.deepEqual(await ids(),['2026-1::synthetic-a','collection-c']);
 await p.locator('#noticeMode').selectOption('merge');assert.equal(await p.locator('.merge-client-choice:checked').count(),2);await p.locator('.merge-client-choice[value="collection-c"]').uncheck();await p.locator('#refreshPreviewBtn').click();assert.equal(await p.locator('.merge-client-choice:checked').count(),1);
 const original=await p.locator('#templateText').inputValue();await p.locator('#templateText').fill(original+'\nSYNTHETIC DRAFT');await p.locator('#collectionDays213').fill('2');assert.deepEqual(await ids(),['2026-1::synthetic-b']);assert.equal(await p.locator('.merge-client-choice:checked').count(),1);assert.match(await p.locator('#templateText').inputValue(),/SYNTHETIC DRAFT/);assert((await p.locator('#templatePreview').inputValue()).includes(dates.two.replaceAll('-','/')));
 await p.locator('#collectionDays213').fill('3');assert.deepEqual(await ids(),[]);assert.equal(await p.locator('#templatePreview').inputValue(),'');assert(await p.locator('#copyNoticeBtn').isDisabled());assert.match(await p.locator('#collectionStatus213').textContent(),/沒有符合客戶/);
 await p.locator('#collectionDays213').fill('');assert.equal(await p.locator('#collectionDays213').getAttribute('aria-invalid'),'true');await p.locator('#collectionDays213').fill('1');await p.locator('#noticeMode').selectOption('single');await p.locator('#copyNoticeBtn').click();await p.locator('.toast').filter({hasText:'已複製訊息'}).last().waitFor();
 let b=await backup(p);const notices=b.data.notifications.filter(n=>n.id!=='synthetic-notice');assert.equal(notices.length,1);assert.equal(notices[0].periodClientId,'2026-1::synthetic-a');
 await p.locator('.nav-btn[data-view="templates"]').click();await p.locator('#templateText').fill('SYNTHETIC {客戶} {預約收發票日}');await p.locator('#saveTemplateBtn').click();await p.locator('.toast').filter({hasText:'模板已儲存'}).last().waitFor();
 await p.locator('[data-template-tab="export"]').click();await p.locator('#exportTemplateClearBtn').click();await p.locator('.txt-template-choice[value="collectionTomorrow211_default"]').check();assert.equal(await p.locator('#txtClients option:checked').count(),2);await p.locator('#collectionDays213').fill('2');assert.deepEqual(await p.locator('#txtClients option').evaluateAll(es=>es.map(e=>e.value)),['2026-1::synthetic-b']);assert.equal(await p.locator('#txtClients option:checked').count(),1);const txt=await download(p,()=>p.locator('#exportTxtBtn').click());assert.match(txt.toString(),/合成測試客戶乙/);assert(!txt.toString().includes('合成測試客戶甲'));assert(txt.toString().includes(dates.two.replaceAll('-','/')));
 await p.locator('[data-template-tab="manage"]').click();await p.locator('#collectionDays213').fill('1');await screenshot(p,'vat213-collection-desktop-'+dates.today);
 await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await screenshot(p,'vat213-collection-mobile-'+dates.today);await p.setViewportSize({width:1440,height:1000});
 // A return after midnight advances the date, rather than retaining yesterday's target.
 await p.clock.setFixedTime(new Date('2027-01-01T16:30:00Z'));await p.evaluate(()=>window.dispatchEvent(new Event('focus')));assert((await p.locator('#collectionDate213').textContent()).includes(dates.two.replaceAll('-','/')));
 await p.locator('[data-select-type="firstBilling"]').first().click();assert(await p.locator('#collectionFilter213').isHidden());assert((await ids()).length>=4,'Other notices retain the full applicable list');
}
module.exports={originals,collection};
