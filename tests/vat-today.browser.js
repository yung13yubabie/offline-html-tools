'use strict';
const assert=require('node:assert/strict');
const nav=(p,view)=>p.locator(`.nav-btn[data-view="${view}"]`).click();

async function seedReminderCards(p){
 await p.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{
   const request=indexedDB.open('VAT_WORKBENCH_DB');
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
  const at='2026-10-01T00:00:00.000Z',audit={createdAt:at,updatedAt:at,revision:1,version:1};
  const contracts=['a','a','b','b'].map((client,index)=>({
   id:'today-contract-'+index,clientId:'synthetic-'+client,title:'合成租約 '+(index+1),categoryId:'lease',
   startDate:'2026-01-01',endDate:'2026-11-'+String(index+10),leadMonths:2,closed:false,reminderEnabled:true,
   task:'SYNTHETIC FULL TASK TEXT FOR CONTRACT DETAILS',taskCompletedAt:'',note:'',...audit
  }));
  const cases=['a','b','a'].map((client,index)=>({
   id:'today-case-'+index,clientId:'synthetic-'+client,title:index===0?'合成案件｜較長的內容便於測試案由標籤換行':'合成案件 '+index,
   status:'inProgress',startDate:'2026-10-01',dueDate:'2026-11-15',dueTime:'',reminderEnabled:true,
   reminderDate:'2026-10-20',reminderTime:'09:00',reminderCompletedAt:'',completedAt:'',note:'',...audit
  }));
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(['contracts','cases','clients','periods'],'readwrite');
   for(const contract of contracts)tx.objectStore('contracts').put(contract);
   for(const item of cases)tx.objectStore('cases').put(item);
   tx.objectStore('clients').put({id:'today-outside',code:'TEST-C',name:'合成期外客戶',contacts:[],...audit});
   tx.objectStore('periods').put({id:'2026-6',year:2026,slot:'06',status:'尚未開始',...audit});
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
  });
  db.close();
 });
}

module.exports=async function(p,h){
 await seedReminderCards(p);
 await h.reload(p);
 await p.locator('#topPeriod').selectOption('2026-1');
 const tabs=p.locator('.today-view-tabs210'),actions=p.locator('#view-today .page-head>.actions');
 const caseCard=p.locator('#caseReminderStrip219'),contractCard=p.locator('#contractReminderStrip220');
 const add=actions.locator('#newWorkTask210'),print=actions.locator('#printWorkTasks210');
 assert(await add.isVisible());assert(await print.isVisible());
 assert.equal(await actions.locator('#vatSampleLaunch').count(),1);
 assert(await print.evaluate(el=>el.nextElementSibling?.id==='newWorkTask210'));
 const bounds=async element=>element.evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,top:r.top,bottom:r.bottom};});
 const left=await bounds(caseCard),right=await bounds(contractCard);
 assert(Math.abs(left.width-right.width)<1&&Math.abs(left.top-right.top)<1&&Math.abs(left.bottom-right.bottom)<1);
 assert(await tabs.evaluate(el=>getComputedStyle(el).flexDirection==='row'));
 assert.equal(await caseCard.locator('.today-case-row226').count(),3);
 assert.match(await caseCard.locator('.today-case-topic226').first().textContent(),/合成案件/);
 assert.equal(await contractCard.locator('.today-contract-group226').count(),2);
 assert.equal(await contractCard.locator('.today-contract-group226').first().locator('.today-contract-row226').count(),2);
 assert(!/SYNTHETIC FULL TASK TEXT/.test(await contractCard.innerText()));
 await h.screenshot(p,'vat226-today-desktop');
 await tabs.locator('#todayWorkTab210').focus();
 await tabs.locator('#todayWorkTab210').press('ArrowRight');
 assert.equal(await tabs.locator('#todaySystemTab210').getAttribute('aria-selected'),'true');
 assert(await p.locator('#todayTodos').isVisible());
 await tabs.locator('#todaySystemTab210').press('Home');
 await contractCard.locator('#allContractTodos220').click();
 assert(await p.locator('#systemTaskPane210').isVisible());
 await tabs.locator('#todayWorkTab210').click();

 await contractCard.locator('[data-open-contract220]').first().click();
 assert.equal(await p.locator('#contract-title220').inputValue(),'合成租約 1');
 await p.locator('#cancelContract220').click();
 await contractCard.locator('[data-contract-complete220]').first().click();
 await p.locator('.toast').filter({hasText:'合約待辦已完成'}).last().waitFor();
 assert.equal(await contractCard.locator('[data-contract-complete220="today-contract-0"]').count(),0);

 const taskSearch=p.locator('#taskSearch210');
 await taskSearch.fill('合成工作待辦');
 await p.evaluate(()=>{window.print=()=>{window.syntheticTodayPrinted=true;};});
 await print.click();
 assert(await p.evaluate(()=>window.syntheticTodayPrinted));
 assert.equal(await p.locator('#printRoot .task-report210 tbody tr').count(),1);
 assert.match(await p.locator('#printRoot').textContent(),/合成工作待辦/);
 await taskSearch.fill('');
 await actions.locator('#newWorkTask210').click();
 assert(await p.locator('#tdName210').isVisible());
 await p.locator('[data-task-close210]').click();
 const jump=p.locator('#customerJump226'),search=p.locator('#globalSearch');
 await p.keyboard.press('Control+k');
 await search.fill('TEST-B');
 assert.equal(await jump.locator('[data-g-client]').count(),1);
 await search.press('Enter');
 assert(await jump.isHidden());
 assert.match(await p.locator('#workDetail .detail-head').innerText(),/合成測試客戶乙/);
 await p.locator('[data-work-focus="receipt"]').click();
 await p.locator('#wNotes').fill('SYNTHETIC KEEP MY DRAFT');
 await p.locator('#globalSearchLaunch').click();
 await search.fill('TEST-A');
 p.once('dialog',dialog=>dialog.dismiss());
 await search.press('Enter');
 assert(await jump.isVisible());
 assert.equal(await p.locator('#wNotes').inputValue(),'SYNTHETIC KEEP MY DRAFT');
 p.once('dialog',dialog=>dialog.accept());
 await search.press('Enter');
 assert.match(await p.locator('#workDetail .detail-head').innerText(),/合成測試客戶甲/);
 await p.locator('#globalSearchLaunch').click();
 await search.fill('TEST-C');
 await search.press('Enter');
 assert(await p.locator('#mClientCode').isVisible());
 await p.locator('#modalRoot [data-close]').click();

 await p.locator('#topPeriod').selectOption('2026-6');
 for(const width of [320,390,800,1024]){
  await p.setViewportSize({width,height:850});
  const period=p.locator('#topPeriod');
  assert(await period.evaluate(el=>{
   const ctx=document.createElement('canvas').getContext('2d'),style=getComputedStyle(el);
   ctx.font=style.font;
   const text=el.selectedOptions[0].textContent;
   return el.getBoundingClientRect().width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-20>=ctx.measureText(text).width;
  }),'Full period fits at '+width);
  for(const view of ['today','calendar','cases','contracts','clients','work','accounting','templates','pdf','backup','settings']){
   await nav(p,view);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),view+' page width at '+width);
   assert.equal(await p.locator(`#view-${view} .page-head>.actions #vatSampleLaunch`).count(),1);
  }
 }
 await p.setViewportSize({width:390,height:850});
 await nav(p,'today');
 await p.locator('#topPeriod').selectOption('2026-1');
 assert(Math.abs((await bounds(print)).top-(await bounds(add)).top)<1);
 await h.screenshot(p,'vat226-today-mobile');
 await p.locator('#globalSearchLaunch').click();
 assert(await jump.isVisible());
 await search.press('Escape');
 assert(await jump.isHidden());
};
