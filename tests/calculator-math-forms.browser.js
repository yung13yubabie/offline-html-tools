'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
module.exports=async function calculatorMathForms(p){
 const before={expression:await p.locator('#calcExpression').textContent(),result:await p.locator('#calcResult').textContent()},viewport=p.viewportSize();
 const out=path.resolve(__dirname,'../test-results/browser');fs.mkdirSync(out,{recursive:true});
 const coeff=(row,col)=>p.locator(`.equation-row[data-row="${row}"] .linear-coefficient[data-column="${col}"]`);
 const sign=(row,col)=>p.locator(`.equation-row[data-row="${row}"] .linear-sign[data-column="${col}"]`);
 const constant=row=>p.locator('#linearConstant'+row);
 const state=async(id,status)=>assert.equal(await p.locator('#'+id+'Result').getAttribute('data-status'),status);
 const clear=async id=>{assert.equal((await p.locator('#'+id+'Result').textContent()).trim(),'');assert.equal(await p.locator('#'+id+'Result').getAttribute('data-status'),null);};
 async function dialog(action,accept=true){const handle=d=>accept?d.accept():d.dismiss();p.on('dialog',handle);try{await action();}finally{p.off('dialog',handle);}}
 async function preset(name,accept=true){await dialog(()=>p.locator('#linearPreset').selectOption(name),accept);}
 async function solve(){await p.locator('#linearSolveBtn').click();}
 async function ratio(){await p.locator('#ratioCalculateBtn').click();}
 async function capture(id,name){await p.locator('#'+id).scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});}
 try{
  await p.locator('[data-panel=generalPanel]').click();
  assert.equal(await p.locator('#linearEntryMode').inputValue(),'form');assert(await p.locator('#linearBuilder').isVisible());assert(await p.locator('#linearTextEditor').isHidden());
  assert.equal(await p.locator('#linearTool').evaluate(e=>e.closest('.batch-card')),null,'Math worksheets are independently discoverable');
  assert.equal(await p.locator('.equation-row').count(),2);assert.equal(await p.locator('.linear-coefficient').count(),4);
  await solve();await state('linear','error');assert.match(await p.locator('#linearResult').textContent(),/第 1 條等號右側/);
  await preset('two');await clear('linear');assert.match(await p.locator('#linearPreview').textContent(),/1 × x \+ 1 × y = 100/);
  await solve();await state('linear','unique');assert.match(await p.locator('#linearResult').textContent(),/x = 60/);assert.match(await p.locator('#linearResult').textContent(),/y = 40/);
  await preset('three',false);assert.equal(await p.locator('#linearVariableCount').inputValue(),'2');assert.equal(await constant(0).inputValue(),'100');
  await preset('three');await solve();await state('linear','unique');for(const [name,value]of [['x',1],['y',2],['z',3]])assert.match(await p.locator('#linearResult').textContent(),new RegExp(name+' = '+value));
  await coeff(2,2).fill('7');await clear('linear');await p.locator('#linearVariableCount').selectOption('2');await p.locator('#linearEquationCount').selectOption('2');
  await p.locator('#linearVariableCount').selectOption('3');await p.locator('#linearEquationCount').selectOption('3');assert.equal(await coeff(2,2).inputValue(),'7');assert.equal(await sign(2,2).inputValue(),'-');assert.equal(await constant(2).inputValue(),'2');
  await preset('two');await coeff(0,0).fill('-1');await solve();await state('linear','error');assert.match(await p.locator('#linearResult').textContent(),/正負號/);
  await coeff(0,0).fill('1');await sign(0,1).selectOption('-');await constant(0).fill('20');await coeff(1,0).fill('1');await coeff(1,1).fill('1');await constant(1).fill('100');await solve();await state('linear','unique');assert.match(await p.locator('#linearResult').textContent(),/x = 60/);assert.match(await p.locator('#linearResult').textContent(),/y = 40/);
  await coeff(0,0).fill('1,000');await sign(0,1).selectOption('+');await coeff(0,1).fill('');await constant(0).fill('2,000');await coeff(1,0).fill('');await coeff(1,1).fill('1');await constant(1).fill('3');await solve();await state('linear','unique');assert.match(await p.locator('#linearResult').textContent(),/x = 2/);
  await p.locator('#linearEquationCount').selectOption('1');await solve();await state('linear','infinite');
  await coeff(0,0).fill('<img src=x onerror=window.__mathXSS=1>');await solve();await state('linear','error');assert.equal(await p.locator('#linearPreview img').count(),0);assert.equal(await p.evaluate(()=>window.__mathXSS),undefined);
  await preset('two');await p.locator('#linearEntryMode').selectOption('text');await clear('linear');await p.locator('#linearInput').fill('x=9');await solve();await state('linear','unique');
  await p.locator('#linearEntryMode').selectOption('form');assert.equal(await constant(0).inputValue(),'100');await solve();await state('linear','unique');
  await p.locator('#linearEntryMode').selectOption('text');assert.equal(await p.locator('#linearInput').inputValue(),'x=9');
  await dialog(()=>p.locator('#linearUseFormBtn').click(),false);assert.equal(await p.locator('#linearInput').inputValue(),'x=9');
  await dialog(()=>p.locator('#linearUseFormBtn').click());assert.match(await p.locator('#linearInput').inputValue(),/1\*x \+ 1\*y = 100/);await solve();await state('linear','unique');
  await p.locator('#linearEntryMode').selectOption('form');await p.locator('#linearVariableCount').selectOption('10');await p.locator('#linearEquationCount').selectOption('20');assert.equal(await p.locator('.linear-coefficient').count(),200);await coeff(19,9).fill('8');assert.equal(await coeff(19,9).inputValue(),'8');
  assert(await p.locator('#linearRows').evaluate(e=>e.scrollHeight>e.clientHeight&&getComputedStyle(e).overflowY==='auto'),'Large form uses a bounded inner scroll area');
  await preset('two');await solve();await capture('linearTool','accounting-calculator-guided-linear-desktop');
  assert.equal(await p.locator('#ratioBasis').inputValue(),'whole');assert.equal(await p.locator('#ratioBasePercent').inputValue(),'100');assert(await p.locator('#ratioBasePercent').evaluate(e=>e.readOnly));
  await p.locator('#ratioBaseValue').fill('200');await p.locator('#ratioTarget').fill('50');await ratio();await state('ratio','success');assert.match(await p.locator('#ratioResult').textContent(),/q = 25%/);
  await p.locator('#ratioBasis').selectOption('custom');await clear('ratio');assert(!(await p.locator('#ratioBasePercent').evaluate(e=>e.readOnly)));await p.locator('#ratioBasePercent').fill('40');await p.locator('#ratioTarget').fill('100');await ratio();assert.match(await p.locator('#ratioResult').textContent(),/q = 20%/);
  await p.locator('#ratioMode').selectOption('reverse');await clear('ratio');assert.equal(await p.locator('#ratioTarget').inputValue(),'');assert(await p.locator('#ratioTargetUnit').isVisible());await p.locator('#ratioTarget').fill('20');await ratio();assert.match(await p.locator('#ratioResult').textContent(),/N = 100/);
  await p.locator('#ratioMode').selectOption('forward');assert.equal(await p.locator('#ratioTarget').inputValue(),'100');await p.locator('#ratioMode').selectOption('reverse');assert.equal(await p.locator('#ratioTarget').inputValue(),'20');
  await p.locator('#ratioBasis').selectOption('whole');assert.equal(await p.locator('#ratioBasePercent').inputValue(),'100');await p.locator('#ratioBasis').selectOption('custom');assert.equal(await p.locator('#ratioBasePercent').inputValue(),'40');
  await p.locator('#ratioBaseValue').fill('1,000');await p.locator('#ratioBasePercent').fill('50');await p.locator('#ratioTarget').fill('25');await ratio();assert.match(await p.locator('#ratioResult').textContent(),/N = 500/);
  await p.locator('#ratioBasePercent').fill('0');await ratio();await state('ratio','error');await p.locator('#ratioBasePercent').fill('50');await clear('ratio');await p.locator('#ratioTarget').fill('25%');await ratio();await state('ratio','error');
  await p.locator('#ratioTarget').fill('25');await p.locator('#ratioTarget').press('Enter');await state('ratio','success');
  assert(await p.locator('.ratio-answer').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=28),'The ratio answer must be a large result, not helper text');
  await capture('ratioTool','accounting-calculator-guided-ratio-desktop');
  for(const width of [390,320]){
   await p.setViewportSize({width,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   for(const id of ['linearTool','ratioTool']){
    await p.locator('#'+id).scrollIntoViewIfNeeded();assert(await p.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}));
    const clipped=await p.locator('#'+id+' input,'+'#'+id+' select').evaluateAll(elements=>elements.filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect(),card=e.closest('.guided-tool').getBoundingClientRect();return r.left<card.left-1||r.right>card.right+1;}).map(e=>e.id||e.className));assert.deepEqual(clipped,[]);
    await p.locator('#'+id).screenshot({path:path.join(out,'accounting-calculator-guided-'+id+'-'+width+'.png'),animations:'disabled'});
   }
  }
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.guided-chevron').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');await p.emulateMedia({reducedMotion:'no-preference'});
  assert.equal(await p.locator('#calcExpression').textContent(),before.expression);assert.equal(await p.locator('#calcResult').textContent(),before.result);
 }finally{
  await p.setViewportSize(viewport);await p.locator('#linearEntryMode').selectOption('text');await p.locator('#linearInput').fill('');await p.locator('#linearEntryMode').selectOption('form');await p.locator('#ratioMode').selectOption('forward');
 }
};
