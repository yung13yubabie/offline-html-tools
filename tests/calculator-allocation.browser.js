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
  await id('Start').fill('2026-09-01');
  await id('End').fill('2027-08-31');
  await id('Calculate').click();
  const rows=page.locator('.allocation-equation19');
  assert.deepEqual(await rows.allTextContents(),['1,000 × 122/365','1,000 × 243/365']);
  assert.deepEqual(await page.locator('.allocation-row-amount19 strong').allTextContents(),['334.25','665.75']);
  await id('ShowAmount').uncheck();
  assert.deepEqual(await rows.allTextContents(),['122/365','243/365']);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
   writeText:async()=>{throw Error('synthetic clipboard rejection');}
  }}));
  await id('Copy').click();
  await id('CopyFallback').waitFor();
  assert.equal(await id('CopyFallback').inputValue(),'2026 年｜122/365\n2027 年｜243/365');
  await id('ShowRatio').uncheck();
  assert(await id('Copy').isDisabled());
  assert(!await id('CopyFallback').isVisible());
  await id('ShowRatio').check();
  await id('Unit').selectOption('month');
  assert(await id('Copy').isDisabled(),'A changed input invalidates earlier output');
  await id('Calculate').click();
  assert.equal(await rows.count(),12);
  assert.match(await rows.first().innerText(),/30\/365/);
  await id('End').fill('2026-08-31');
  await id('Calculate').click();
  assert.equal(await id('End').getAttribute('aria-invalid'),'true');
  assert(await id('Copy').isDisabled());
  await id('End').fill('2031-08-31');
  await id('Calculate').click();
  await id('Next').click();
  assert.equal(await rows.count(),10);
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
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
