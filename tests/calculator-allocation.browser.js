'use strict';
const assert = require('node:assert/strict');

module.exports = async function allocationBrowser(sourcePage,{screenshot}){
 const page=await sourcePage.context().newPage(), id=name=>page.locator('#allocation'+name+'19');
 try{
  await page.goto(sourcePage.url());
  await page.locator('[data-panel="allocationPanel"]').click();
  assert.equal(await id('Unit').inputValue(),'year');
  assert(await id('ShowAmount').isChecked());
  assert(await id('ShowRatio').isChecked());
  assert(!await id('ShowDates').isChecked());
  assert(!await id('ShowResult').isChecked());
  await id('Amount').fill('1000');
  await id('Start').pressSequentially('2026/9/1');
  await id('End').fill('20270831');
  const rows=page.locator('.allocation-equation19');
  await rows.first().waitFor();
  assert.deepEqual(await rows.allTextContents(),['1,000 × 122/365','1,000 × 243/365']);
  assert.deepEqual(await page.locator('.allocation-row-amount19 strong').allTextContents(),['334.25','665.75']);
  assert.deepEqual(await page.locator('.allocation-row-dates19').allTextContents(),[
   '2026-09-01 ～ 2026-12-31','2027-01-01 ～ 2027-08-31'
  ]);
  await screenshot?.(page,'calculator-allocation-desktop');
  await id('ShowAmount').uncheck();
  assert.deepEqual(await rows.allTextContents(),['122/365','243/365']);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
   writeText:async()=>{throw Error('synthetic clipboard rejection');}
  }}));
  await id('Copy').click();
  await id('CopyFallback').waitFor();
  assert.equal(await id('CopyFallback').inputValue(),'2026 年｜122/365\n2027 年｜243/365');
  await id('ShowDates').check();
  await id('Copy').click();
  await id('CopyFallback').waitFor();
  assert.match(await id('CopyFallback').inputValue(),/2026-09-01 ～ 2026-12-31/);
  await id('ShowDates').uncheck();
  await id('ShowRatio').uncheck();
  assert(await id('Copy').isDisabled());
  assert(!await id('CopyFallback').isVisible());
  await id('ShowRatio').check();
  await id('Unit').selectOption('month');
  assert.equal(await rows.count(),12);
  assert.match(await rows.first().innerText(),/30\/365/);
  await id('End').fill('2026/8/31');
  assert(await id('Copy').isDisabled(),'A changed input invalidates earlier output');
  await id('End').press('Tab');
  assert.equal(await id('End').getAttribute('aria-invalid'),'true');
  assert.match(await id('EndError').innerText(),/不能早於/);
  await id('Start').fill('2026/2/30');
  await id('Start').press('Tab');
  assert.equal(await id('Start').getAttribute('aria-invalid'),'true');
  assert.match(await id('StartError').innerText(),/日期不存在/);
  await id('Start').fill('2026-09-01');

  // Exercise the visible native-field fallback, including its selection-to-calculation path.
  await id('EndPicker').evaluate(picker=>{picker.showPicker=()=>{throw Error('synthetic unavailable picker');};});
  await id('EndPickerButton').click();
  assert.equal(await id('EndPicker').getAttribute('aria-hidden'),'false');
  await id('EndPicker').fill('2031-08-31');
  assert.equal(await id('End').inputValue(),'2031-08-31');
  assert.equal(await id('EndPicker').getAttribute('aria-hidden'),'true');
  assert.equal(await id('End').getAttribute('aria-invalid'),null);
  await id('Next').click();
  assert.equal(await rows.count(),10);
  for(const width of [1024,390,320]){
   await page.setViewportSize({width,height:844});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const start=await id('Start').boundingBox(),end=await id('End').boundingBox();
   assert(start.width>=180);
   if(width<681)assert(end.y>=start.y+start.height+12,'Mobile dates occupy separate rows');
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.scrollTo(0,0));
  await screenshot?.(page,'calculator-allocation-mobile');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#clearCalculationsBtn').click();
  assert.equal(await id('Amount').inputValue(),'');
  assert.equal(await id('Start').inputValue(),'');
  assert.equal(await id('Unit').inputValue(),'month');
  assert(!await id('ShowAmount').isChecked());
  assert(await id('Copy').isDisabled());
 }finally{await page.close();}
};
