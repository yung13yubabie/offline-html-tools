'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
module.exports=async function calculatorTaxGroups(sourcePage){
 const p=await sourcePage.context().newPage(),errors=[],requests=[];
 p.on('pageerror',error=>errors.push(error.message));
 const sourceURL=sourcePage.url(),origin=sourceURL.startsWith('http')?new URL(sourceURL).origin:null;
 p.on('request',request=>{const url=request.url();if(/^https?:/i.test(url)&&(!origin||new URL(url).origin!==origin))requests.push(url)});
 const out=path.resolve(__dirname,'../test-results/browser');fs.mkdirSync(out,{recursive:true});
 try{
  await p.setViewportSize({width:1440,height:1000});await p.goto(sourceURL);await p.locator('[data-panel="generalPanel"]').click();
  const root=p.locator('#taxGroupsTool');await root.waitFor({state:'visible'});if(!await root.evaluate(e=>e.open))await root.locator('summary').click();
  const rows=p.locator('#taxGroupsRows .tax-groups-row'),rate=p.locator('#taxGroupsRate'),precision=p.locator('#taxGroupsPrecision');
  const cell=(index,field)=>rows.nth(index).locator('[data-tax-result="'+field+'Cents"]');
  const amount=index=>rows.nth(index).locator('.tax-groups-input');
  async function expect(index,net,tax,gross){for(const [field,value]of [['net',net],['tax',tax],['gross',gross]])assert.equal(await cell(index,field).textContent(),value);}
  async function mode(value){await root.locator('[name="taxGroupsMode"][value="'+value+'"]').check();assert.equal(await root.locator('[name="taxGroupsMode"]:checked').count(),1);}
  async function reset(){await p.evaluate(()=>window.OfflineTaxGroups19.reset());}
  assert.equal(await rows.count(),3);assert(await root.locator('[value="gross"]').isChecked());assert.equal(await precision.inputValue(),'yuan');assert.equal(await p.locator('#taxGroupsNetTotal').textContent(),'—');
  await rate.fill('5');await amount(0).fill('105.50');await expect(0,'100.50','5.00','105.50');
  await precision.selectOption('cent');await expect(0,'100.48','5.02','105.50');
  await amount(1).fill('-10.50');await expect(1,'−10.00','−0.50','−10.50');
  assert.equal(await p.locator('#taxGroupsGrossTotal').textContent(),'95.00');
  await mode('net');assert.equal(await p.locator('#taxGroupsInputHeading').textContent(),'輸入未稅金額');assert.equal(await amount(0).inputValue(),'105.50');await expect(0,'105.50','5.28','110.78');
  await reset();await precision.selectOption('yuan');await amount(0).fill('10');await amount(1).fill('10');await amount(2).fill('10');
  assert.equal(await p.locator('#taxGroupsTaxTotal').textContent(),'3.00','Each row rounds before totaling; aggregate tax would be 2');
  await amount(1).fill('-10');await expect(1,'−10.00','−1.00','−11.00');
  await amount(2).fill('not a number');assert.equal(await amount(2).getAttribute('aria-invalid'),'true');await expect(2,'—','—','—');
  assert.equal(await p.locator('#taxGroupsTotalLabel').textContent(),'有效列小計');assert.equal(await p.locator('#taxGroupsGrossTotal').textContent(),'0.00');assert.match(await p.locator('#taxGroupsTotalNote').textContent(),/1 筆待修正/);
  await amount(2).fill('');assert.equal(await amount(2).getAttribute('aria-invalid'),null);assert.equal(await p.locator('#taxGroupsTotalLabel').textContent(),'總計');assert.match(await p.locator('#taxGroupsCount').textContent(),/2 筆有效/);
  await precision.selectOption('cent');await amount(0).fill('0.10');await amount(1).fill('-0.10');await expect(0,'0.10','0.01','0.11');await expect(1,'−0.10','−0.01','−0.11');
  await rate.fill('0');await expect(0,'0.10','0.00','0.10');await rate.fill('wrong');assert.equal(await rate.getAttribute('aria-invalid'),'true');assert.equal(await p.locator('#taxGroupsTaxTotal').textContent(),'—');await expect(0,'—','—','—');
  assert.match(await p.locator('#taxGroupsRateError').textContent(),/稅率/);await rate.fill('5');await expect(0,'0.10','0.01','0.11');
  await amount(0).fill('1,234.56');await expect(0,'1,234.56','61.73','1,296.29');await amount(0).fill('1,23');assert.equal(await amount(0).getAttribute('aria-invalid'),'true');
  await amount(0).fill('1.001');assert.equal(await amount(0).getAttribute('aria-invalid'),'true');await amount(0).fill('0');await expect(0,'0.00','0.00','0.00');

  // Amount validation remains independent while the shared rate is invalid.
  await amount(0).fill('x');assert.equal(await amount(0).getAttribute('aria-invalid'),'true');
  assert.match(await rows.nth(0).locator('.tax-groups-error').textContent(),/金額/);
  await rate.fill('x');await amount(0).fill('105');
  assert.equal(await amount(0).getAttribute('aria-invalid'),null);assert.equal(await rows.nth(0).locator('.tax-groups-error').textContent(),'');
  assert.equal(await rate.getAttribute('aria-invalid'),'true');assert.match(await p.locator('#taxGroupsRateError').textContent(),/稅率/);await expect(0,'—','—','—');
  await amount(0).fill('bad amount');assert.equal(await amount(0).getAttribute('aria-invalid'),'true');assert.match(await rows.nth(0).locator('.tax-groups-error').textContent(),/金額/);
  await amount(0).fill('');assert.equal(await amount(0).getAttribute('aria-invalid'),null);assert.equal(await rows.nth(0).locator('.tax-groups-error').textContent(),'');
  await amount(0).fill('105');await rate.fill('5');await expect(0,'105.00','5.25','110.25');

  const expression=await p.locator('#calcExpression').textContent();await amount(2).fill('');await amount(2).pressSequentially('123');await amount(2).press('Enter');
  assert.equal(await rows.count(),4);assert.equal(await amount(3).evaluate(e=>e===document.activeElement),true);assert.equal(await p.locator('#calcExpression').textContent(),expression,'Worksheet keyboard input must not change the keypad');
  await amount(3).fill('200');await rows.nth(1).locator('.tax-groups-remove').click();assert.equal(await rows.count(),3);assert.equal(await amount(1).inputValue(),'123');assert.equal(await amount(1).evaluate(e=>e===document.activeElement),true);
  await p.locator('#taxGroupsAddBtn').click();assert.equal(await rows.count(),4);assert.equal(await amount(3).evaluate(e=>e===document.activeElement),true);

  // Following the shared rate is one-way; local editing never mutates invoice rows or rate.
  const invoiceBefore=await p.locator('#taxPanel .tax-input').evaluateAll(es=>es.map(e=>e.value));
  const globalRate=await p.locator('#taxRateInput').inputValue();await rate.fill('7.25');assert.equal(await p.locator('#taxRateInput').inputValue(),globalRate);
  assert.deepEqual(await p.locator('#taxPanel .tax-input').evaluateAll(es=>es.map(e=>e.value)),invoiceBefore);
  await p.locator('#taxRateInput').evaluate(e=>{e.value='7.5';e.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal(await rate.inputValue(),'7.5');
  await mode('net');await precision.selectOption('cent');await amount(0).fill('999.99');
  await p.evaluate(()=>document.dispatchEvent(new Event('calculator:clear-data')));
  assert.equal(await rows.count(),3);assert.deepEqual(await rows.locator('.tax-groups-input').evaluateAll(es=>es.map(e=>e.value)),['','','']);
  assert.equal(await rate.inputValue(),'7.5');assert.equal(await precision.inputValue(),'cent');assert(await root.locator('[value="net"]').isChecked());assert.equal(await p.locator('#taxGroupsNetTotal').textContent(),'—');
  await amount(0).fill('100.25');await amount(1).fill('-25.10');
  await root.scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,'accounting-calculator-tax-groups-desktop.png'),animations:'disabled'});
  const widths=await rows.first().locator('.tax-groups-field').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().width));assert(Math.max(...widths)-Math.min(...widths)<1,'Four money fields share equal widths');
  for(const width of [390,320]){
   await p.setViewportSize({width,height:844});await root.scrollIntoViewIfNeeded();
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   for(const control of [amount(0),precision,rate,rows.first().locator('.tax-groups-remove'),p.locator('#taxGroupsAddBtn')]){
    await control.scrollIntoViewIfNeeded();const box=await control.boundingBox();assert(box&&box.x>=0&&box.x+box.width<=width+1,'Worksheet controls fit at '+width);
   }
   assert(await amount(0).evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16));await p.screenshot({path:path.join(out,'accounting-calculator-tax-groups-'+width+'.png'),animations:'disabled'});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 }finally{await p.close();}
};
