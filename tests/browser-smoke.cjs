'use strict';
// Synthetic-only, isolated file:// smoke suite. Run from repository root.
// Playwright version pinned by .github/workflows/browser-smoke.yml (mirrored in ci/). No production browser/profile.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'..'), OUT=path.join(ROOT,'test-results','browser');
fs.mkdirSync(OUT,{recursive:true});
const report={scope:'Synthetic Chromium file:// smoke only; not exhaustive, not legal/accounting certification',storage:'Fresh browser context for each app. Reload persistence tested only on the same exact file URL; moving/renaming files or other browsers may change file:// storage behavior.',checks:[],apps:[],notCovered:['Full PDF compatibility/encryption/font fidelity','All financial edge cases and statutory correctness','Cross-browser/mobile-device behavior','Large datasets/performance stress','Every backup corruption/schema case','Visual screenshot review is manual; artifacts alone do not prove visual correctness']};
let browser;
async function check(name,fn){try{await fn();report.checks.push({name,status:'pass'});console.log('PASS',name)}catch(e){report.checks.push({name,status:'fail',error:String(e.stack||e)});console.error('FAIL',name,e.message)}}
async function visible(p,selector){await p.locator(selector).waitFor({state:'visible'});}
async function screenshot(p,name){await p.screenshot({path:path.join(OUT,name+'.png'),fullPage:true});}
async function download(p,trigger){const [d]=await Promise.all([p.waitForEvent('download'),trigger()]);assert.equal(await d.failure(),null);return fs.readFileSync(await d.path());}
const parseJSON=b=>JSON.parse(b.toString('utf8').replace(/^\uFEFF/,''));
async function feedback(p,id){
 const ui=p.locator('#offline-review-host');
 await ui.getByRole('button',{name:'修改標註',exact:true}).click();
 const options=await ui.locator('select option').evaluateAll(es=>es.filter(e=>e.value!=='').map(e=>({value:e.value,text:e.textContent})));
 assert(options.length>0,'App needs actual selectable review blocks');
 assert.equal(await ui.locator('.note').count(),0,'Isolated first run starts with no annotations');
 if(id==='accounting-calculator'){
  const before={expression:await p.locator('#calcExpression').textContent(),result:await p.locator('#calcResult').textContent()};
  await ui.locator('textarea').pressSequentially('123+4');
  assert.equal(await p.locator('#calcExpression').textContent(),before.expression,'Typing in feedback must not reach calculator shortcuts');
  assert.equal(await p.locator('#calcResult').textContent(),before.result);
  await p.locator('[data-key="C"]').click();
  assert.equal(await p.locator('#calcExpression').textContent(),before.expression,'Business clicks must be blocked during feedback');
  assert.equal(await p.locator('#calcResult').textContent(),before.result);
  await ui.locator('textarea').fill('');
 }
 // Exercise every currently visible registered block, not only the first form.
 for(const o of options){await ui.locator('select').selectOption(o.value);await ui.locator('textarea').fill(`SYNTHETIC QA ${id} ${o.value}: <img src=x onerror=alert(1)>`);await ui.getByRole('button',{name:'儲存標註',exact:true}).click();}
 assert.equal(await ui.locator('.note').count(),options.length);
 assert.equal(await ui.locator('.note img').count(),0,'Notes must remain text');
 const data=parseJSON(await download(p,()=>ui.getByRole('button',{name:'匯出 JSON',exact:true}).click()));
 assert.equal(data.schemaVersion,1);assert.equal(data.annotations.length,options.length);assert(data.appId&&data.appVersion);
 for(const n of data.annotations){assert(n.block.id&&n.block.name&&n.block.selector);assert(n.text.startsWith('SYNTHETIC QA'));}
 const txt=await download(p,()=>ui.getByRole('button',{name:'匯出 TXT',exact:true}).click());assert(txt.toString().includes('尚未實作'));
 // Check edit and delete are functional and do not add duplicates.
 await ui.locator('.note').first().getByRole('button',{name:/^編輯/}).click();await ui.locator('textarea').fill('SYNTHETIC QA updated');await ui.getByRole('button',{name:'更新標註',exact:true}).click();assert.equal(await ui.locator('.note').count(),options.length);assert.match(await ui.locator('.note').first().textContent(),/updated/);
 await screenshot(p,id+'-feedback-desktop');
 await p.keyboard.press('Escape');assert(await ui.locator('.panel').isHidden());
 await p.reload();await ui.getByRole('button',{name:'修改標註',exact:true}).click();assert.equal(await ui.locator('.note').count(),options.length,'Same-URL reload should retain annotations');
 p.once('dialog',d=>d.accept());await ui.locator('.note').first().getByRole('button',{name:/^刪除/}).click();assert.equal(await ui.locator('.note').count(),options.length-1);
 await p.setViewportSize({width:390,height:844});await ui.locator('select').selectOption(options[0].value);await ui.locator('textarea').fill('SYNTHETIC QA mobile');await ui.getByRole('button',{name:'儲存標註',exact:true}).click();
 const box=await ui.locator('.panel').boundingBox();assert(box&&box.width<=390&&box.x>=-1&&box.x+box.width<=391,'Feedback panel fits 390px viewport');await screenshot(p,id+'-feedback-mobile');await p.keyboard.press('Escape');await screenshot(p,id+'-mobile');
 await p.setViewportSize({width:1440,height:1000});
}
async function mobileLayout(p,id){
 await p.setViewportSize({width:390,height:844});
 try{
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Document must not overflow the 390px viewport');
  const ui=p.locator('#offline-review-host');
  async function reachable(locator,{trial=true}={}){
   await locator.evaluate(e=>e.scrollIntoView({block:'center',inline:'center'}));
   const b=await locator.boundingBox(),t=await ui.locator('.toggle').boundingBox();
   assert(b&&b.x>=-1&&b.x+b.width<=391&&b.y>=0&&b.y+b.height<=844,'Control must fit after scrolling');
   assert(!t||b.x+b.width<=t.x||b.x>=t.x+t.width||b.y+b.height<=t.y||b.y>=t.y+t.height,'Closed feedback toggle must not cover the reachable control');
   assert(await locator.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit)}),'Control center must not be intercepted');
   if(trial)await locator.click({trial:true});
  }
  if(id==='accounting-calculator'||id==='ledger-analyzer'){
   await p.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
   const last=p.locator(id==='accounting-calculator'?'#copyBatchBtn':'#emptyWorkspace button');
   await reachable(last);await p.screenshot({path:path.join(OUT,id+'-mobile-bottom-controls.png')});
  }else if(id==='vat-workbench'){
   await p.locator('.nav-btn[data-view="today"]').click();
   await reachable(p.locator('#newWorkTask210'));
   const empty=p.locator('.task-empty210');await visible(p,'.task-empty210');
   assert(await empty.evaluate(e=>{const r=e.getBoundingClientRect(),wrap=e.closest('.task-table-scroll210').getBoundingClientRect();return r.left>=wrap.left&&r.right<=wrap.right+1}),'Empty queue explanation must fit, not be centered offscreen in a 780px table');
   await reachable(empty.locator('button'));await empty.locator('button').click();
   await p.locator('.main').evaluate(e=>e.scrollTop=e.scrollHeight);
   await reachable(p.locator('#taskPageSize210'));await p.locator('#taskPageSize210').selectOption('24');
   await reachable(p.locator('#taskPrev210'),{trial:false});await reachable(p.locator('#taskNext210'),{trial:false});
   await p.screenshot({path:path.join(OUT,id+'-mobile-bottom-controls.png')});
   await p.locator('.main').evaluate(e=>e.scrollTop=0);await p.screenshot({path:path.join(OUT,id+'-mobile-empty-queue.png')});
  }else if(id==='pdf-workbench'){
   const controls=p.locator('.top-actions>button,.toolbar>button,.toolbar>.pill');
   for(let i=0;i<await controls.count();i++){
    const item=controls.nth(i);
    assert(await item.evaluate(e=>{const range=document.createRange();range.selectNodeContents(e);const lines=[...range.getClientRects()].filter(r=>r.width&&r.height);return getComputedStyle(e).whiteSpace==='nowrap'&&new Set(lines.map(r=>Math.round(r.top))).size<=1}),'PDF toolbar labels must stay on one horizontal line');
    await reachable(item,{trial:await item.evaluate(e=>e.tagName==='BUTTON'&&!e.disabled)});
   }
   await p.locator('.top-actions').evaluate(e=>e.scrollLeft=0);await p.locator('.toolbar').evaluate(e=>e.scrollLeft=0);await p.screenshot({path:path.join(OUT,id+'-mobile-toolbar-start.png')});
   // Verify scrolling reaches the actual rightmost output action after a synthetic import.
   const png=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=8;c.height=8;return c.toDataURL('image/png').split(',')[1]});
   const count=await p.locator('.page-card').count();await p.locator('#imageInput').setInputFiles({name:'synthetic-mobile.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await p.waitForFunction(n=>document.querySelectorAll('.page-card').length===n+1,count);
   await reachable(p.locator('#exportBtn'));await p.screenshot({path:path.join(OUT,id+'-mobile-toolbar-output.png')});await p.locator('#exportBtn').click();await visible(p,'#outputDialog');await p.locator('[data-close="outputDialog"]').click();
  }
 }finally{await p.setViewportSize({width:1440,height:1000});}
}

async function nativeDialogFeedback(p){
 const ui=p.locator('#offline-review-host');
 const png=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=8;c.height=8;return c.toDataURL('image/png').split(',')[1]});
 const oldCount=await p.locator('.page-card').count();await p.locator('#imageInput').setInputFiles({name:'synthetic-modal.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await p.waitForFunction(n=>document.querySelectorAll('.page-card').length===n+1,oldCount);await p.locator('#selectAllBtn').click();const pageCount=await p.locator('.page-card').count();assert(pageCount>0);

 await p.locator('#mergeBtn').click();await visible(p,'#mergeDialog');
 await p.waitForFunction(()=>document.querySelector('#offline-review-host')?.parentElement?.id==='mergeDialog');
 assert.equal(await p.locator('#mergeDialog').evaluate(e=>e.matches(':modal')),true);
 await ui.getByRole('button',{name:'修改標註',exact:true}).click();
 const opts=await ui.locator('select option').evaluateAll(es=>es.filter(e=>e.value!=='').map(e=>e.value));assert(opts.length>0);
 for(const v of opts){await ui.locator('select').selectOption(v);assert.match(await ui.locator('.selected').textContent(),/mergeDialog/);await ui.locator('textarea').fill('SYNTHETIC QA draft');await ui.locator('textarea').press('Control+z');await ui.locator('textarea').press('Delete');assert.equal(await p.locator('.page-card').count(),pageCount,'Feedback keyboard input must not undo/delete PDF pages');await ui.locator('textarea').fill('SYNTHETIC QA modal feedback');await ui.getByRole('button',{name:'儲存標註',exact:true}).click();}
 // A business cancel click is selection-only during annotation mode.
 await p.locator('[data-close="mergeDialog"]').click();assert(await p.locator('#mergeDialog').isVisible());
 await screenshot(p,'pdf-workbench-native-dialog-feedback');
 await p.keyboard.press('Escape');assert(await ui.locator('.panel').isHidden());assert(await p.locator('#mergeDialog').isVisible(),'Escape exits feedback without closing the business dialog');
 await p.locator('[data-close="mergeDialog"]').click();await p.waitForFunction(()=>document.querySelector('#offline-review-host')?.parentElement===document.body);assert(await p.locator('#mergeDialog').isHidden());
}
async function storageFailure(kind){
 const context=await browser.newContext({acceptDownloads:true});
 await context.route(/^https?:/i,r=>r.abort('blockedbyclient'));
 await context.addInitScript(kind=>{
  const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
  if(kind==='unavailable')Storage.prototype.getItem=function(key){if(String(key).startsWith('offline-review:'))throw new DOMException('Synthetic unavailable','SecurityError');return get.call(this,key)};
  Storage.prototype.setItem=function(key,value){if(String(key).startsWith('offline-review:'))throw new DOMException('Synthetic '+kind,kind==='unavailable'?'SecurityError':'QuotaExceededError');return set.call(this,key,value)};
 },kind);
 try{
  const p=await context.newPage();p.setDefaultTimeout(15000);const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(path.join(ROOT,'apps/accounting-calculator.html')).href);
  const ui=p.locator('#offline-review-host');await ui.getByRole('button',{name:'修改標註',exact:true}).click();if(kind==='unavailable')assert.match(await ui.locator('[role="status"]').textContent(),/無法讀取標註儲存空間/);await ui.locator('select').selectOption('0');await ui.locator('textarea').fill('SYNTHETIC QA storage failure');await ui.getByRole('button',{name:'儲存標註',exact:true}).click();
  assert.equal(await ui.locator('.note').count(),1);assert.match(await ui.locator('[role="status"]').textContent(),/請立即匯出/);
  const data=parseJSON(await download(p,()=>ui.getByRole('button',{name:'匯出 JSON',exact:true}).click()));assert.equal(data.annotations[0].text,'SYNTHETIC QA storage failure');assert.deepEqual(errors,[]);await screenshot(p,'feedback-storage-'+kind);
 }finally{await context.close();}
}
async function calculator(p){
 for(const mode of ['generalPanel','taxPanel','insurancePanel','generalPanel']){await p.locator(`[data-panel="${mode}"]`).click();await visible(p,'#'+mode);}
 for(const [expr,result] of [['1+2','3'],['2+3*4','14'],['(2+3)*4','20'],['0.1+0.2','0.3']]){
 await p.locator('[data-key="C"]').click();for(const key of expr)await p.locator(`[data-key="${key}"]`).click();await p.locator('[data-key="="]').click();assert.equal((await p.locator('#calcResult').textContent()).replace(/,/g,'').trim(),result,expr);
 }
 await p.locator('[data-mem="MC"]').click();await p.locator('[data-mem="M+"]').click();await p.locator('[data-key="C"]').click();await p.locator('[data-mem="MR"]').click();assert.equal((await p.locator('#calcResult').textContent()).trim(),'0.3');
 const before=await p.locator('.batch-row').count();await p.locator('#addBatchBtn').click();assert.equal(await p.locator('.batch-row').count(),before+1);
}
async function calculatorScreenshot(p,name){
 // Toasts use opacity transitions, so Playwright's visibility predicate alone is insufficient.
 await p.waitForFunction(()=>[...document.querySelectorAll('.toast')].every(e=>getComputedStyle(e).opacity==='0'||getComputedStyle(e).display==='none'));
 await screenshot(p,name);
}
// Calculator-only presentation regression, separate from the new math-tools contract below.
// All amounts below are synthetic and retain the pre-existing 5% arithmetic contract.
async function calculatorPresentation(p){
 const font=locator=>locator.evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
 const amount=async selector=>Number((await p.locator(selector).textContent()).replace(/,/g,'').trim());
 const categories=['salesTriple','inputReceipt'];
 const cat=id=>p.locator(`.category[data-cat="${id}"]`);
 async function finishEntry(book){await book.locator('.focus-done').waitFor({state:'visible'});await book.locator('.focus-done').click();await book.locator('.focus-done').waitFor({state:'hidden'});}
 async function assertTotals(){assert.equal(await amount('#salesTaxTotal'),617);assert.equal(await amount('#inputTaxTotal'),117);assert.equal(await amount('#finalTax'),500);}
 async function summaryNoCollision(scope){
  const collisions=await scope.locator('.book-summary,.category-summary').evaluateAll(summaries=>summaries.flatMap(summary=>{
   const boxes=[...summary.querySelectorAll('.sum-label,.sum-value')].flatMap((e,i)=>{const range=document.createRange();range.selectNodeContents(e);return [...range.getClientRects()].filter(r=>r.width&&r.height).map(r=>({i,text:e.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom}))});
   const found=[];for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){const x=boxes[a],y=boxes[b];if(x.i!==y.i&&Math.min(x.right,y.right)-Math.max(x.left,y.left)>.5&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>.5)found.push([x.text,y.text]);}return found;
  }));
  assert.deepEqual(collisions,[],'Actual summary text glyphs must not collide (including the long inputReceipt title at 390px)');
 }

 try{
  await p.locator('[data-panel="taxPanel"]').click();await visible(p,'#taxPanel');
  assert.match(await p.locator('.session-note').innerText(),/重新整理.*清空/,'Keep a concise warning about losing current calculations');
  for(const id of ['taxPanel','taxSettings','salesSide','inputSide'])assert.equal(await p.locator('#'+id).getAttribute('data-review-id'),'accounting-calculator-'+id,'Existing annotation identities must remain stable');
  for(const [id,net,tax,gross] of [['salesTriple',12340,617,12957],['inputReceipt',2340,117,2457]]){
   const category=cat(id),book=category.locator('.book').first();
   await category.locator('.category-head').click();await book.locator('.book-toggle').click();
   const row=book.locator('.tax-row').first();await row.locator('[data-field="net"]').fill(String(net));
   for(const [field,value] of [['tax',tax],['gross',gross]])assert.equal(Number((await row.locator(`[data-field="${field}"]`).inputValue()).replace(/,/g,'')),value);
   await calculatorScreenshot(p,`accounting-calculator-tax-${id}-expanded-desktop`);
   await finishEntry(book);
   assert(await book.locator('.book-body').isVisible(),'Entered detail must remain expanded after confirmation');
  }
  await assertTotals();
  async function typography(category){
   const name=category.locator('.category-name'),sum=category.locator('.category-summary .sum-value').first(),book=category.locator('.book').first();
   assert(await font(name)>=await font(sum),'Category title must not be smaller than its summary amount');
   assert(await font(book.locator('.book-toggle'))>=await font(book.locator('.book-summary .sum-value').first()),'Book title must not be smaller than its summary amount');
   for(const locator of [name,book.locator('.book-toggle'),book.locator('.table-head'),book.locator('.tax-input').first()])assert(await font(locator)>=13,'Core tax text must remain readable, not tiny metadata');
   assert(await font(category.locator('.sum-label').first())>=.75*await font(sum),'Summary labels should not shrink far below the amount text');
   const expected=(await category.getAttribute('data-cat'))==='salesTriple'?'壹萬貳仟玖佰伍拾柒':'貳仟肆佰伍拾柒';
   for(const upper of [category.locator('.category-upper'),book.locator('.book-upper'),book.locator('.upper-mini').first()]){
    assert((await upper.textContent()).includes(expected),'Chinese money text must preserve the actual gross amount');
    const digit=upper.locator('.cn-digit').first(),unit=upper.locator('.cn-unit').first();
    assert(await digit.isVisible()&&await unit.isVisible(),'Both numeral and place-value glyphs must be visible');
    assert(await font(digit)>await font(unit),'Financial numerals should be larger than place-value units');
    const style=locator=>locator.evaluate(e=>{const s=getComputedStyle(e);return {weight:s.fontWeight,color:s.color}});
    const a=await style(digit),b=await style(unit);assert(Number(a.weight)>Number(b.weight),'Numerals need emphasis beyond color alone');assert.notEqual(a.color,b.color,'Digit/unit distinction should also use contrasting text treatment');
   }
  }
  for(const id of categories)await typography(cat(id));
  await p.evaluate(()=>{window.scrollTo(0,0);document.querySelectorAll('.tax-side').forEach(e=>e.scrollTop=0)});
  await calculatorScreenshot(p,'accounting-calculator-tax-populated-desktop');
  // Open the real settings UI: neither a direction symbol nor a bare mode name is enough context.
  await p.locator('#toggleSettingsBtn').click();await visible(p,'#taxSettings');
  const options=await p.locator('#taxSettings [data-enter-default] option,.book .enter-select option').allTextContents();
  assert(options.length>0);for(const label of options)assert.match(label,/下一筆.*欄位|下一欄|下一列|向右|向下/,'Enter navigation options must explain the direction in words');
  for(const id of categories){const labels=await cat(id).locator('.mode-select option').allTextContents();assert(labels.some(x=>/逐筆|單筆|個別.*輸入/.test(x)),'Individual mode should explain how to enter');assert(labels.some(x=>/匯總.*輸入|合計|彙總/.test(x)),'Summary mode should explain how to enter');}
  await calculatorScreenshot(p,'accounting-calculator-tax-settings-desktop');await p.locator('#toggleSettingsBtn').click();
  await p.setViewportSize({width:390,height:844});
  // Resizing and switching sides restores the last input focus. Confirm via the actual UI,
  // rather than deleting focus classes or altering app state in the test.
  await finishEntry(cat('salesTriple').locator('.book').first());
  for(const [side,id] of [['sales','salesTriple'],['input','inputReceipt']]){
   if(side==='input'){await p.locator(`#sideTabs [data-side="${side}"]`).click();await finishEntry(cat(id).locator('.book').first());}
   await typography(cat(id));await summaryNoCollision(cat(id));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Populated tax page must fit at 390px');
   await p.evaluate(side=>{window.scrollTo(0,0);document.getElementById(side+'Side').scrollTop=0},side);
   await calculatorScreenshot(p,`accounting-calculator-tax-${side}-populated-mobile`);
   const book=cat(id).locator('.book').first();await book.locator('.tax-input').first().click();await visible(p,'.book.focus-active');
   await summaryNoCollision(book);
   const upper=book.locator('.upper-mini').first();
   assert(await upper.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&e.scrollWidth<=e.clientWidth+1}),'Expanded Chinese money text should fit the narrow viewport without horizontal clipping');
   await calculatorScreenshot(p,`accounting-calculator-tax-${side}-expanded-mobile`);await finishEntry(book);
  }
  await assertTotals();
  await p.locator('[data-panel="insurancePanel"]').click();await visible(p,'#insurancePanel');
  const insurance=await p.locator('#insurancePanel').innerText();
  assert(!/直接內嵌於此 HTML|完整內嵌級距/.test(insurance),'Insurance UI should use task language, not implementation details');
  assert.match(insurance,/一般全時受僱|一般受僱/,'Applicability must remain explicit');assert.match(insurance,/特殊身分/,'Special cases must not disappear during copy cleanup');assert.match(insurance,/帳單.*核對|依帳單核對/,'Keep the need to reconcile actual bills');
  await p.locator('#insurancePanel details.cost-note summary').click();assert(await p.locator('#insurancePanel details.cost-note').getAttribute('open')!==null,'Calculation details should remain accessible');
  await p.locator('#salaryBracketInput').fill('42000');await p.locator('#salaryBracketInput').press('Tab');
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Insurance page must fit 390px; only its wide table may scroll locally');
  await p.evaluate(()=>window.scrollTo(0,0));await calculatorScreenshot(p,'accounting-calculator-insurance-copy-mobile');
  await p.setViewportSize({width:1440,height:1000});await p.evaluate(()=>window.scrollTo(0,0));await calculatorScreenshot(p,'accounting-calculator-insurance-copy-desktop');
 }finally{
  await p.setViewportSize({width:1440,height:1000});
  const done=p.locator('.book.focus-active .focus-done');if(await done.isVisible())await done.click();
  await p.locator('[data-panel="generalPanel"]').click();
 }
}
// The owner explicitly confirmed multiline linear equations and bidirectional proportional conversion.
async function calculatorMathTools(p){
 const before={expression:await p.locator('#calcExpression').textContent(),result:await p.locator('#calcResult').textContent()};
 async function state(id,expected){assert.equal(await p.locator(id).getAttribute('data-status'),expected);}
 async function cleared(id){assert.equal((await p.locator(id).textContent()).trim(),'','Editing must remove stale answers and errors');assert.equal(await p.locator(id).getAttribute('data-status'),null,'Editing also clears the previous result status');}
 async function solve(text){await p.locator('#linearInput').fill(text);await cleared('#linearResult');await p.locator('#linearSolveBtn').click();}
 async function ratio(){await p.locator('#ratioCalculateBtn').click();}
 try{
  await p.locator('[data-panel="generalPanel"]').click();
  for(const id of ['linearTool','ratioTool']){
   assert.equal(await p.locator('#'+id).getAttribute('data-review-id'),'accounting-calculator-'+id);
   const summary=p.locator('#'+id+' > summary');
   await summary.focus();await summary.press('Enter');
   assert.notEqual(await p.locator('#'+id).getAttribute('open'),null,'Enter on a focused summary must open the tool');
   await summary.press('Enter');assert.equal(await p.locator('#'+id).getAttribute('open'),null,'Enter must also close the tool');
   await summary.press('Enter');assert.notEqual(await p.locator('#'+id).getAttribute('open'),null,'Repeated keyboard activation must reopen it');
  }
  await p.locator('#linearInput').pressSequentially('x+y=5');await p.locator('#linearInput').press('Enter');await p.locator('#linearInput').pressSequentially('2*x-y=1');
  assert.equal(await p.locator('#calcExpression').textContent(),before.expression,'Typing equations must not trigger main calculator shortcuts');assert.equal(await p.locator('#calcResult').textContent(),before.result);
  await p.locator('#linearSolveBtn').click();await state('#linearResult','unique');
  assert.match(await p.locator('#linearResult').textContent(),/x\s*=\s*2(?:\D|$)/);assert.match(await p.locator('#linearResult').textContent(),/y\s*=\s*3(?:\D|$)/);
  await solve('x+y=1\nx+y=2');await state('#linearResult','inconsistent');assert.match(await p.locator('#linearResult').textContent(),/無解|矛盾/);
  await solve('x*y=2\nx+y=3');await state('#linearResult','error');assert.match(await p.locator('#linearResult').textContent(),/線性|一次式/);
  await solve('');await state('#linearResult','error');
  await solve('x+y=5\n2*x-y=1');await state('#linearResult','unique');
  await p.locator('#ratioBaseValue').fill('200');await p.locator('#ratioBasePercent').fill('40');await p.locator('#ratioTarget').fill('100');
  await ratio();await state('#ratioResult','success');assert.match(await p.locator('#ratioResult').textContent(),/q\s*=\s*20\s*%/);
  await p.locator('#ratioMode').selectOption('reverse');await cleared('#ratioResult');assert.match(await p.locator('#ratioTargetLabel').textContent(),/百分比/);await p.locator('#ratioTarget').fill('20');
  await ratio();await state('#ratioResult','success');assert.match(await p.locator('#ratioResult').textContent(),/N\s*=\s*100(?:\D|$)/);
  await p.locator('#ratioTarget').fill('');await cleared('#ratioResult');await ratio();await state('#ratioResult','error');
  await p.locator('#ratioTarget').fill('20');await p.locator('#ratioBasePercent').fill('0');await ratio();await state('#ratioResult','error');
  await p.locator('#ratioBasePercent').fill('40');await p.locator('#ratioMode').selectOption('forward');await p.locator('#ratioBaseValue').fill('0');await ratio();await state('#ratioResult','error');
  await p.locator('#ratioBaseValue').fill('200');await p.locator('#ratioTarget').fill('0');await ratio();await state('#ratioResult','success');assert.match(await p.locator('#ratioResult').textContent(),/q\s*=\s*0\s*%/,'Zero target is valid, unlike a zero denominator');
  await p.locator('#ratioTarget').fill('100');await ratio();await state('#ratioResult','success');
  await p.locator('#linearTool').scrollIntoViewIfNeeded();await calculatorScreenshot(p,'accounting-calculator-math-tools-desktop');
  await p.setViewportSize({width:390,height:844});
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'New math tools must not overflow 390px');
  for(const id of ['linearTool','ratioTool']){
   const tool=p.locator('#'+id);await tool.scrollIntoViewIfNeeded();
   assert(await tool.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1}),'New math tool must fit the narrow viewport');
   await p.waitForFunction(()=>[...document.querySelectorAll('.toast')].every(e=>getComputedStyle(e).opacity==='0'||getComputedStyle(e).display==='none'));
   await tool.screenshot({path:path.join(OUT,`accounting-calculator-${id}-mobile.png`)});
  }
  await p.setViewportSize({width:1440,height:1000});
  // The original calculator must still evaluate normally after both new tools were used.
  assert.equal(await p.locator('#calcExpression').textContent(),before.expression);assert.equal(await p.locator('#calcResult').textContent(),before.result);
  await p.locator('[data-key="C"]').click();for(const key of '2+3')await p.locator(`[data-key="${key}"]`).click();await p.locator('[data-key="="]').click();assert.equal((await p.locator('#calcResult').textContent()).trim(),'5');
 }finally{await p.setViewportSize({width:1440,height:1000});}
}
async function ledger(p){
 await p.locator('[data-action="demo"]').click();await visible(p,'#datasetStats');assert.match(await p.locator('#datasetStats').textContent(),/16/);
 for(const mode of ['summary','offset','search','years','duplicates','summary']){await p.locator('#nav-'+mode).click();await visible(p,'#'+mode);assert.equal(await p.locator('#nav-'+mode).getAttribute('aria-selected'),'true');}
 await p.locator('[data-action="analyze"]').click();await p.locator('#nav-search').click();await p.locator('#searchKeyword').fill('電話費');await p.locator('#searchKeyword').press('Enter');assert(await p.locator('.record-summary').count()>0);
 // Import only synthetic CSV; canary sets a flag if unsafely interpreted as HTML.
 const csv='項目,日期,傳票號碼,摘要,借方,貸方\n測試費用(借),114-01-01,TEST001,"<img src=x onerror=window.__qaXSS=1>",100,0\n';
 await p.locator('#changeDataset').click();await p.locator('#fileInput').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from('\uFEFF'+csv)});await p.locator('#importButton').click();await p.waitForFunction(()=>document.querySelector('#fileBadge')?.textContent.includes('synthetic.csv') && document.querySelector('#importButton')?.getAttribute('aria-busy')!=='true');
 await p.locator('#nav-search').click();await p.locator('#searchKeyword').fill('');await p.locator('#searchKeyword').press('Enter');assert.equal(await p.evaluate(()=>window.__qaXSS),undefined);assert.equal(await p.locator('.record-summary img').count(),0);assert.match(await p.locator('.record-summary').first().textContent(),/<img/);
}
async function vat(p){
 for(const mode of ['today','calendar','clients','work','accounting','templates','pdf','backup','settings','today']){await p.locator(`.nav-btn[data-view="${mode}"]`).click();await visible(p,'#view-'+mode);}
 await p.locator('.nav-btn[data-view="backup"]').click();const original=parseJSON(await download(p,()=>p.locator('#fullBackupBtn').click()));assert(original.backupVersion&&original.data);assert(Array.isArray(original.data.clients));assert.equal(original.data.clients.length,0,'Published default must not include client records');
 await p.locator('#restoreFile').setInputFiles({name:'synthetic-empty.taxbackup',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))});await p.locator('#restoreMergeBtn').click();await visible(p,'#modalRoot.show');await p.locator('#modalRoot .modal-foot').getByRole('button',{name:'合併',exact:true}).click();await p.locator('.toast').filter({hasText:'合併完成'}).waitFor({state:'visible'});
 const after=parseJSON(await download(p,()=>p.locator('#fullBackupBtn').click()));assert.equal(after.data.clients.length,0);assert.equal(after.data.templates.length,original.data.templates.length,'Merge must not duplicate default templates');
 await p.reload();await p.locator('.nav-btn[data-view="backup"]').click();const reloaded=parseJSON(await download(p,()=>p.locator('#fullBackupBtn').click()));assert.equal(reloaded.data.clients.length,0);
}
async function pdf(p){
 // Create an original synthetic PNG in-browser, never read a user's file.
 const png=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=60;const x=c.getContext('2d');x.fillStyle='#2176ae';x.fillRect(0,0,80,60);x.fillStyle='white';x.fillRect(10,10,25,25);return c.toDataURL('image/png').split(',')[1]});
 await p.locator('#imageInput').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await p.locator('.page-card').first().waitFor();assert.equal(await p.locator('.page-card').count(),1);
 await p.locator('#selectAllBtn').click();await p.locator('#rotRBtn').click();assert.match(await p.locator('.page-card .rotation').textContent(),/90/);await p.locator('#dupBtn').click();assert.equal(await p.locator('.page-card').count(),2);
 await p.locator('#previewBtn').click();await visible(p,'#previewDialog');assert.equal(await p.locator('#previewGallery .preview-page').count(),2);await p.locator('[data-close="previewDialog"]').click();
 await p.locator('#exportBtn').click();const bytes=await download(p,()=>p.locator('#runOutputBtn').click());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert(bytes.length>100);
 // A second export must also create a valid file.
 if(!(await p.locator('#outputDialog').isVisible()))await p.locator('#exportBtn').click();const second=await download(p,()=>p.locator('#runOutputBtn').click());assert.equal(second.subarray(0,5).toString(),'%PDF-');
 if(await p.locator('#outputDialog').isVisible())await p.locator('[data-close="outputDialog"]').click();
 await p.locator('#backupBtn').click();await visible(p,'#backupDialog');const b=parseJSON(await download(p,()=>p.locator('#exportBackupBtn').click()));assert(b&&typeof b==='object');await p.locator('[data-close="backupDialog"]').click();
 // Reopen the app's own generated PDF, asserting page-count round trip.
 await p.locator('#pdfInput').setInputFiles({name:'synthetic-roundtrip.pdf',mimeType:'application/pdf',buffer:bytes});await p.waitForFunction(()=>document.querySelectorAll('.page-card').length===4);assert.equal(await p.locator('.page-card').count(),4);
}
(async()=>{
 browser=await chromium.launch({headless:true});
 for(const [id,flow] of [['accounting-calculator',calculator],['ledger-analyzer',ledger],['vat-workbench',vat],['pdf-workbench',pdf]]){
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000},serviceWorkers:'block'}),p=await context.newPage();p.setDefaultTimeout(15000);p.setDefaultNavigationTimeout(30000);
 const evidence={id,pageErrors:[],consoleErrors:[],blockedNetwork:[]};report.apps.push(evidence);p.on('pageerror',e=>evidence.pageErrors.push(e.message));p.on('console',m=>{if(m.type()==='error')evidence.consoleErrors.push(m.text())});
 await context.route(/^https?:/i,r=>{evidence.blockedNetwork.push(r.request().url());return r.abort('blockedbyclient')});
 await check(id+' offline initial load',async()=>{const file=path.join(ROOT,'apps',id+'.html');assert(fs.existsSync(file),'Missing deliverable '+file);await p.goto(pathToFileURL(file).href);await visible(p,'body');assert((await p.locator('body').innerText()).length>100);assert.equal(await p.evaluate(()=>location.protocol),'file:');await screenshot(p,id+'-initial');});
 await check(id+' primary flows',()=>flow(p));
 if(id==='accounting-calculator')await check(id+' populated tax readability + labels + insurance copy at desktop and mobile',()=>calculatorPresentation(p));
 if(id==='accounting-calculator')await check(id+' multiline equations + bidirectional ratios + invalid inputs + unchanged keypad',()=>calculatorMathTools(p));
 await check(id+' feedback visible blocks + export + reload + mobile',()=>feedback(p,id));
 await check(id+' mobile controls reachable without clipping or toggle overlap',()=>mobileLayout(p,id));
 if(id==='pdf-workbench')await check(id+' native modal feedback reachability + business-click protection',()=>nativeDialogFeedback(p));
 await check(id+' no uncaught JavaScript errors',()=>assert.deepEqual(evidence.pageErrors,[]));
 await check(id+' no external network requested',()=>assert.deepEqual(evidence.blockedNetwork,[]));
 // Console error diagnostics retained, not treated as uncaught exceptions.
 await context.close();
 }
 for(const kind of ['unavailable','quota'])await check('feedback '+kind+' storage retains exportable in-memory note',()=>storageFailure(kind));
})().catch(e=>{report.checks.push({name:'test infrastructure',status:'fail',error:String(e.stack||e)});console.error(e)}).finally(async()=>{if(browser)await browser.close();report.finishedAt=new Date().toISOString();report.pass=report.checks.filter(x=>x.status==='pass').length;report.fail=report.checks.filter(x=>x.status==='fail').length;fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log(`${report.pass} passed, ${report.fail} failed`);process.exitCode=report.fail?1:0});
