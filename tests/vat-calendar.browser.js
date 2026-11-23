'use strict';
const assert=require('node:assert/strict');

async function crowdedCalendar(page,{reload,screenshot}){
 await page.clock.setFixedTime(new Date(2026,2,10,12));
 await page.evaluate(async()=>{
  const connection=await new Promise((resolve,reject)=>{
   const request=indexedDB.open('VAT_WORKBENCH_DB');
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
  const at='2026-03-01T00:00:00.000Z',clientId='synthetic-a';
  try{
   await new Promise((resolve,reject)=>{
    const tx=connection.transaction(['contracts','cases','calendarNotes'],'readwrite');
    const contracts=tx.objectStore('contracts');
    for(let index=0;index<120;index++)contracts.put({
     id:'calendar-contract-'+index,version:1,revision:1,createdAt:at,updatedAt:at,clientId,categoryId:'lease',
     startDate:'2026-03-01',endDate:'2026-03-10',leadMonths:0,title:'合成租約 '+index,
     closed:false,reminderEnabled:true,task:'核對租約',note:'',taskCompletedAt:''
    });
    tx.objectStore('cases').put({id:'calendar-case',clientId,title:'合成案件',status:'inProgress',
     startDate:'2026-03-09',dueDate:'2026-03-10',dueTime:'08:30',note:'',reminderEnabled:false,reminderDate:'',
     reminderTime:'',reminderCompletedAt:'',completedAt:'',createdAt:at,updatedAt:at});
    const notes=tx.objectStore('calendarNotes');
    for(const [id,time,content] of [['morning','09:00','合成上午'],['afternoon','15:00','合成下午'],['untimed','','合成未定時']])
     notes.put({id,date:'2026-03-10',time,content,clientId,createdAt:at,updatedAt:at});
    tx.oncomplete=resolve;
    tx.onabort=()=>reject(tx.error);
   });
  }finally{connection.close();}
 });
 await reload(page);
 await page.locator('.nav-btn[data-view="calendar"]').click();
 await page.locator('#calendarTodayBtn').click();
 const day=page.locator('[data-calendar-date="2026-03-10"]');
 assert.equal(await day.locator('.calendar-count211').textContent(),'124');
 assert.equal(await day.locator('.calendar-day-preview230').count(),0);
 assert.match(await day.innerText(),/手動 3[\s\S]*案件 1[\s\S]*合約 120/);
 await screenshot(page,'vat230-calendar-crowded-desktop');
 await day.press('Enter');
 const drawer=page.locator('#calendarDrawer');
 assert.equal(await drawer.locator('.calendar-row230').count(),124);
 assert.equal(await drawer.locator('[data-event-source230="contract"]').count(),120);
 assert.match(await drawer.locator('#calendarDrawerCount').innerText(),/124 筆.*合約 120/);
 await page.locator('#calendarDrawerClose').click();
 assert(await day.evaluate(node=>node===document.activeElement));

 const source=page.locator('#calendarSource230');
 await source.selectOption('case');
 assert.equal(await day.locator('.calendar-count211').innerText(),'1');
 await day.click();
 assert.match(await drawer.locator('.calendar-row230').innerText(),/合成案件/);
 await source.selectOption('note');
 assert.equal(await drawer.locator('.calendar-row230').count(),3);
 assert.deepEqual(await drawer.locator('.note-content').allTextContents(),['合成上午','合成下午','合成未定時']);
 await page.locator('#calendarDrawerClose').click();

 await page.locator('#calendarListTab').click();
 assert.equal(await source.inputValue(),'note');
 const list=page.locator('#calendarList'),order=page.locator('#calendarListOrder230');
 assert.match(await order.innerText(),/日期由早到晚/);
 const days=list.locator('.timeline-date');
 assert.match(await days.first().textContent(),/2026\/03\/05/);
 await page.locator('#calendarSort').selectOption('desc');
 assert.match(await order.innerText(),/日期由晚到早/);
 assert.match(await days.first().textContent(),/2026\/03\/10/);
 await source.selectOption('contract');
 assert.equal(await list.locator('.calendar-row230').count(),120);
 await page.locator('#calendarSearch').fill('合成租約 119');
 assert.equal(await list.locator('.calendar-row230').count(),1);
 await page.locator('#calendarClearFilter').click();
 assert.equal(await source.inputValue(),'');
 await page.locator('#calendarMonthTab').click();

 const menu=page.locator('#calendarMoreBtn');
 await menu.click();
 await page.locator('#calMoreHistory').click();
 assert.match(await page.locator('#modalRoot .modal-title').innerText(),/操作紀錄/);
 await page.locator('#modalRoot [data-close]').click();
 await menu.click();
 await page.locator('#calMoreClean').click();
 assert.equal(await page.locator('#calCleanMonth').inputValue(),'2026-03');
 await page.locator('#modalRoot .modal-foot button').last().click();
 assert.match(await page.locator('#modalRoot .modal-body').innerText(),/4 筆記事/);
 await page.locator('#modalRoot .modal-foot button').first().click();
 assert.equal(await day.locator('.calendar-count211').textContent(),'124');
 for(const width of [390,320]){
  await page.setViewportSize({width,height:820});
  await page.waitForFunction(()=>document.getAnimations().every(animation=>
   animation.playState!=='running'||!Number.isFinite(animation.effect?.getComputedTiming().endTime)));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert(await day.evaluate(node=>node.scrollWidth<=node.clientWidth+1));
  assert(await page.locator('#calendarGrid').evaluate(node=>node.scrollWidth<=node.clientWidth+1));
  assert(await source.isVisible());
  assert(await page.locator('#calendarDateFrom').isHidden());
 }
 const extra=page.locator('#view-calendar .calendar-extra-filters230 summary');
 await extra.click();
 assert(await page.locator('#calendarDateFrom').isVisible());
 await extra.click();
 await screenshot(page,'vat230-calendar-crowded-mobile');
}

module.exports=crowdedCalendar;
