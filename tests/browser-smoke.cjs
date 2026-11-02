'use strict';
// Synthetic-only, isolated file:// smoke suite. Run from repository root.
// Playwright version pinned by .github/workflows/browser-smoke.yml (mirrored in ci/). No production browser/profile.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const calculatorPool=require('./calculator-pool.browser.js');
const ROOT=path.resolve(__dirname,'..'), OUT=path.join(ROOT,'test-results','browser');
// Default CI still uses file://. Local HTTP is an explicit fallback for managed browsers.
const BASE=process.env.OFFLINE_TEST_BASE_URL||'';
const appURL=file=>BASE?new URL('apps/'+path.basename(file),BASE).href:pathToFileURL(path.isAbsolute(file)?file:path.join(ROOT,'apps',file)).href;
function networkGuard(evidence){return r=>{if(BASE&&new URL(r.request().url()).origin===new URL(BASE).origin)return r.continue();if(evidence)evidence.blockedNetwork.push(r.request().url());return r.abort('blockedbyclient');};}
fs.mkdirSync(OUT,{recursive:true});
const report={scope:'Synthetic Chromium file:// smoke only; not exhaustive, not legal/accounting certification',storage:'Fresh browser context for each app. Reload persistence tested only on the same exact file URL; moving/renaming files or other browsers may change file:// storage behavior.',checks:[],apps:[],notCovered:['Full PDF compatibility/encryption/font fidelity','All financial edge cases and statutory correctness','Cross-browser/mobile-device behavior','Large datasets/performance stress','Every backup corruption/schema case','Visual screenshot review is manual; artifacts alone do not prove visual correctness']};
if(BASE){report.scope='Synthetic Chromium localhost HTTP smoke; external network blocked; file:// not exercised';report.notCovered.push('Direct file:// opening and file:// storage behavior');}
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

async function floatingPanel(p,id){
 const ui=p.locator('#offline-review-host'),handle=ui.getByRole('button',{name:'移動標註面板',exact:true});
 const noteKey='offline-review:1:'+encodeURIComponent(id),positionKey='offline-review-position:1:'+encodeURIComponent(id);
 const notes=await p.evaluate(k=>localStorage.getItem(k),noteKey);
 const before=await ui.locator('.wrap').boundingBox(),h=await handle.boundingBox();
 await p.mouse.move(h.x+h.width/2,h.y+h.height/2);await p.mouse.down();await p.mouse.move(h.x-650,h.y-500,{steps:12});await p.mouse.up();
 let moved=await ui.locator('.wrap').boundingBox();assert(moved.x<before.x-300&&moved.y<before.y-200,'Closed dock must move with the handle');
 assert(await ui.locator('.panel').isHidden(),'Dragging the dock must not activate annotation mode');
 const saved=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),positionKey);assert(saved&&Math.abs(saved.x-moved.x)<1&&Math.abs(saved.y-moved.y)<1,'Saved coordinates allow subpixel layout rounding');
 await p.reload();moved=await ui.locator('.wrap').boundingBox();assert(Math.abs(moved.x-saved.x)<1&&Math.abs(moved.y-saved.y)<1,'Same URL restores the dock');
 await handle.focus();await p.keyboard.press('ArrowRight');let next=await ui.locator('.wrap').boundingBox();assert.equal(next.x,moved.x+10);
 await p.keyboard.press('Shift+ArrowDown');let down=await ui.locator('.wrap').boundingBox();assert.equal(down.y,next.y+40);
 await ui.locator('.toggle').click();
 async function fits(){await p.waitForFunction(()=>{const r=document.querySelector('#offline-review-host').shadowRoot.querySelector('.wrap').getBoundingClientRect();return r.x>=11&&r.y>=11&&r.right<=innerWidth-11&&r.bottom<=innerHeight-11});const b=await ui.locator('.wrap').boundingBox(),size=p.viewportSize();assert(b&&b.x>=11&&b.y>=11&&b.x+b.width<=size.width-11&&b.y+b.height<=size.height-11,'Entire floating editor must stay in the viewport');}
 await fits();
 // Drag the expanded editor beyond both bottom/right edges; pointer capture keeps movement alive.
 let b=await handle.boundingBox();await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await p.mouse.move(1435,995,{steps:10});await p.mouse.up();await fits();
 await p.setViewportSize({width:390,height:650});await fits();
 await ui.locator('textarea').fill('SYNTHETIC draft survives movement');
 await handle.focus();await p.keyboard.press('ArrowLeft');assert.equal(await ui.locator('textarea').inputValue(),'SYNTHETIC draft survives movement');
 await p.screenshot({path:path.join(OUT,id+'-floating-mobile.png')});
 await ui.locator('textarea').fill('');await p.keyboard.press('Escape');
 await handle.focus();await p.keyboard.press('Home');
 assert.equal(await p.evaluate(k=>localStorage.getItem(k),positionKey),null);
 b=await ui.locator('.wrap').boundingBox();assert(Math.abs(b.x+b.width-378)<1&&Math.abs(b.y+b.height-638)<1,'Home restores right/bottom margin');
 assert.equal(await p.evaluate(k=>localStorage.getItem(k),noteKey),notes,'Position changes must preserve annotations');
 await p.setViewportSize({width:1440,height:1000});
 await p.emulateMedia({media:'print'});assert(await ui.isHidden(),'Floating feedback must not print');await p.emulateMedia({media:'screen',reducedMotion:'reduce'});
 assert.equal(await ui.locator('.toggle').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');await p.emulateMedia({reducedMotion:'no-preference'});
}

async function floatingTouch(){
 for(const id of ['accounting-calculator','ledger-analyzer','vat-workbench','pdf-workbench']){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.route(/^https?:/i,networkGuard());
  try{
   const p=await context.newPage();await p.goto(appURL(id+'.html'));const ui=p.locator('#offline-review-host');
   const before=await ui.locator('.wrap').boundingBox(),h=await ui.locator('.move').boundingBox();
   const cdp=await context.newCDPSession(p),x=h.x+h.width/2,y=h.y+h.height/2;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:60,y:120}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   const after=await ui.locator('.wrap').boundingBox();assert(after.y<before.y-300&&after.x>=12,'Real touch events must drag the dock');assert(await ui.locator('.panel').isHidden());
   await ui.locator('.toggle').tap();await ui.locator('select').selectOption({index:1});await ui.locator('textarea').fill('SYNTHETIC touch note');await ui.getByRole('button',{name:'儲存標註',exact:true}).tap();assert.equal(await ui.locator('.note').count(),1);
   await p.screenshot({path:path.join(OUT,id+'-floating-touch.png')});
  }finally{await context.close();}
 }
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
 await context.route(/^https?:/i,networkGuard());
 await context.addInitScript(kind=>{
  const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
  if(kind==='unavailable')Storage.prototype.getItem=function(key){if(String(key).startsWith('offline-review:'))throw new DOMException('Synthetic unavailable','SecurityError');return get.call(this,key)};
  Storage.prototype.setItem=function(key,value){if(String(key).startsWith('offline-review:'))throw new DOMException('Synthetic '+kind,kind==='unavailable'?'SecurityError':'QuotaExceededError');return set.call(this,key,value)};
 },kind);
 try{
  const p=await context.newPage();p.setDefaultTimeout(15000);const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(appURL('accounting-calculator.html'));
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
 // Full-page CDP capture can transiently resize to 1×1 and invoke real responsive focus navigation.
 // Capture the explicitly positioned viewport; do not suppress app resize handlers or restore focus artificially.
 await p.screenshot({path:path.join(OUT,name+'.png'),fullPage:false});
}
// Calculator-only presentation regression, separate from the new math-tools contract below.
// All amounts below are synthetic and retain the pre-existing 5% arithmetic contract.
async function calculatorPresentation(p){
 const font=locator=>locator.evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
 const amount=async selector=>Number((await p.locator(selector).textContent()).replace(/,/g,'').trim());
 const categories=['salesTriple','inputReceipt'];
 const cat=id=>p.locator(`.category[data-cat="${id}"]`);
 async function intendedBookFocused(book){
  assert(await book.evaluate(e=>e.classList.contains('focus-active')),'The intended invoice book, not another book, must be in focus mode');
  assert.equal(await p.locator('.book.focus-active').count(),1,'Only the intended invoice book may be focused');
 }
 async function finishEntry(book){
  await book.locator('.focus-done').waitFor({state:'visible'});await intendedBookFocused(book);await book.locator('.focus-done').click();await book.locator('.focus-done').waitFor({state:'hidden'});
  // exitBookFocus restores focus asynchronously; wait for its documented final UI state.
  await book.locator('.book-toggle:focus').waitFor({state:'visible'});
 }

 async function assertTotals(){assert.equal(await amount('#salesTaxTotal'),617);assert.equal(await amount('#inputTaxTotal'),117);assert.equal(await amount('#finalTax'),500);}
 async function summaryNoCollision(scope){
  const collisions=await scope.locator('.book-summary,.category-summary').evaluateAll(summaries=>summaries.flatMap(summary=>{
   const boxes=[...summary.querySelectorAll('.sum-label,.sum-value')].flatMap((e,i)=>{const range=document.createRange();range.selectNodeContents(e);return [...range.getClientRects()].filter(r=>r.width&&r.height).map(r=>({i,text:e.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom}))});
   const found=[];for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){const x=boxes[a],y=boxes[b];if(x.i!==y.i&&Math.min(x.right,y.right)-Math.max(x.left,y.left)>.5&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>.5)found.push([x.text,y.text]);}return found;
  }));
  assert.deepEqual(collisions,[],'Actual summary text glyphs must not collide (including the long inputReceipt title at 390px)');
 }

 try{
  await p.evaluate(()=>{
   window.__calculatorFocusTrace=[];
   const record=e=>{const active=document.activeElement,book=document.querySelector('.book.focus-active');window.__calculatorFocusTrace.push({event:e.type,time:performance.now(),width:innerWidth,height:innerHeight,target:e.target.id||e.target.className||e.target.tagName,active:active?.id||active?.className,focusedCategory:book?.closest('.category')?.dataset.cat,activeCategory:active?.closest?.('.category')?.dataset.cat});if(window.__calculatorFocusTrace.length>200)window.__calculatorFocusTrace.shift()};
   document.addEventListener('focusin',record);window.addEventListener('resize',record);
  });
  await p.locator('[data-panel="taxPanel"]').click();await visible(p,'#taxPanel');
  assert.match(await p.locator('.session-note').innerText(),/重新整理.*清空/,'Keep a concise warning about losing current calculations');
  for(const id of ['taxPanel','taxSettings','salesSide','inputSide'])assert.equal(await p.locator('#'+id).getAttribute('data-review-id'),'accounting-calculator-'+id,'Existing annotation identities must remain stable');
  // A page can fit while its tax columns clip the summary row's last control.
  // Exercise both sides of the navigation breakpoint with the wider summary-input grid.
  const widthCategory=cat('salesTriple'),widthBook=widthCategory.locator('.book').first();
  await widthCategory.locator('.category-head').click();await widthBook.locator('.book-toggle').click();
  await widthBook.locator('.mode-select').selectOption('summary');
  for(const width of [981,1000,1080,1081,1200,1280,1281]){
   await p.setViewportSize({width,height:1000});
   await p.evaluate(()=>new Promise(requestAnimationFrame));
   const geometry=await widthBook.evaluate(book=>{
    const side=book.closest('.tax-side'),bounds=side.getBoundingClientRect();
    const left=bounds.left+side.clientLeft,right=left+side.clientWidth;
    const clipped=[...book.querySelectorAll('.table-head>div,.tax-input,.delete-row,.book-controls select,.book-controls button')].flatMap(e=>{
     const r=e.getBoundingClientRect();return r.width&&r.height&&(r.left<left-.5||r.right>right+.5)?[{element:e.className||e.tagName,text:e.textContent,left:r.left,right:r.right}]:[];
    });
    return {clientWidth:side.clientWidth,scrollWidth:side.scrollWidth,clipped};
   });
   assert.equal(geometry.scrollWidth,geometry.clientWidth,`${width}px tax column must fit the summary grid without horizontal scrolling`);
   assert.deepEqual(geometry.clipped,[],`${width}px tax headers, amount inputs and delete controls must fit their column`);
  }
  await p.setViewportSize({width:1440,height:1000});
  await widthBook.locator('.mode-select').selectOption('individual');
  await widthBook.locator('.book-toggle').click();await widthCategory.locator('.category-head').click();
  for(const [id,net,tax,gross] of [['salesTriple',12340,617,12957],['inputReceipt',2340,117,2457]]){
   const category=cat(id),book=category.locator('.book').first();
   await category.locator('.category-head').click();await book.locator('.book-toggle').click();
   const row=book.locator('.tax-row').first(),entry=row.locator('[data-field="net"]');
   // A real pointer click checks actionability; fill alone can write behind an overlay.
   await entry.click();await intendedBookFocused(book);await entry.fill(String(net));await intendedBookFocused(book);
   for(const [field,value] of [['tax',tax],['gross',gross]])assert.equal(Number((await row.locator(`[data-field="${field}"]`).inputValue()).replace(/,/g,'')),value);
   await calculatorScreenshot(p,`accounting-calculator-tax-${id}-expanded-desktop`);await intendedBookFocused(book);
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
  const trace=await p.evaluate(()=>window.__calculatorFocusTrace);fs.writeFileSync(path.join(OUT,'accounting-calculator-presentation-trace.json'),JSON.stringify({trace,method:'Viewport-only screenshots; production resize handlers unchanged'},null,2));assert(!trace.some(e=>e.event==='resize'&&(e.width<=1||e.height<=1)),'Presentation capture must not transiently resize the real app to 1×1');
 }catch(error){
  // Capture the failure before cleanup changes the selected tab, viewport, or focus.
  try{
   await p.screenshot({path:path.join(OUT,'accounting-calculator-presentation-failure.png'),fullPage:false});
   const context=await p.evaluate(()=>({trace:window.__calculatorFocusTrace,viewport:{width:innerWidth,height:innerHeight},activeElement:document.activeElement?.outerHTML,focusedBooks:[...document.querySelectorAll('.book.focus-active')].map(e=>({category:e.closest('.category')?.dataset.cat,book:e.dataset.book}))}));
   fs.writeFileSync(path.join(OUT,'accounting-calculator-presentation-failure.json'),JSON.stringify({error:String(error.stack||error),...context},null,2));
  }catch(captureError){console.error('Calculator failure capture:',captureError.message)}
  throw error;
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
async function vatSettle(p){
 await p.evaluate(async()=>{await new Promise(requestAnimationFrame);const animations=document.getAnimations().filter(a=>a.playState==='running'&&Number.isFinite(a.effect?.getComputedTiming().endTime));let timer;try{await Promise.race([Promise.all(animations.map(a=>a.finished.catch(error=>{if(a.playState!=='idle')throw error}))),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Finite VAT animations did not settle within 5 seconds')),5000)})]);}finally{clearTimeout(timer)}});
}
async function vatScreenshot(p,name){await vatSettle(p);await screenshot(p,name);}
async function vatReload(p){await p.reload();await p.waitForFunction(()=>typeof document.querySelector('#saveWorkBtn')?.onclick==='function');}
// Revision fixtures are wholly synthetic. Each group owns a fresh context, including popup diagnostics.
async function vatRevisionContext(run){
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000},serviceWorkers:'block'});
 const evidence={id:'vat-revision',pageErrors:[],consoleErrors:[],blockedNetwork:[]};report.apps.push(evidence);
 context.on('page',page=>{page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(30000);page.on('pageerror',e=>evidence.pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')evidence.consoleErrors.push(m.text())});});
 await context.route(/^https?:/i,networkGuard(evidence));
 try{const p=await context.newPage();await p.clock.setFixedTime(new Date('2026-10-31T12:00:00Z'));await p.goto(appURL('vat-workbench.html'));await p.waitForFunction(()=>document.querySelector('#topPeriod option')&&typeof document.querySelector('#saveWorkBtn')?.onclick==='function');
 await p.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('VAT_WORKBENCH_DB');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const settings=await new Promise((resolve,reject)=>{const r=db.transaction('settings').objectStore('settings').getAll();r.onsuccess=()=>resolve(r.result[0]);r.onerror=()=>reject(r.error)});
  const at='2026-01-01T00:00:00.000Z',clients=['a','b'].map((id,i)=>({id:'synthetic-'+id,code:'TEST-'+id.toUpperCase(),name:'合成測試客戶'+(i?'乙':'甲'),address:'合成測試地址（非真實）',contacts:[{name:'合成聯絡人',contact:'TEST ONLY'}],bookkeepingFee:(i+1)*1200,businessItem:'合成測試',shippingPreset:{type:'郵寄'},createdAt:at,updatedAt:at}));
  const periods=[{id:'2026-1',year:2026,slot:1,status:'進行中',latestRemitDate:'2026-03-10',latestDispatchDate:'',dueDate:'2026-03-15'},{id:'2026-2',year:2026,slot:2,status:'已結束',unlocked:false,latestRemitDate:'2026-05-10',latestDispatchDate:'2026-05-08',dueDate:'2026-05-15'},{id:'2026-3',year:2026,slot:3,status:'進行中',dueDate:'2026-07-15'}];
  const pcs=periods.slice(0,2).flatMap(period=>clients.map(c=>({id:period.id+'::'+c.id,periodId:period.id,clientId:c.id,snapshot:{...c},preShipping:{type:'郵寄',addressSource:'client',recipientSource:'client'},shippingHistory:[],preShippingChangeHistory:[],notApplicable:false,appointmentDate:'2026-03-01',receiptStatusId:settings.receiptStatuses[0].id,receiptStatusHistory:[],receiptNote:'合成收件備註',taxAmount:500,fees:[{id:period.id+'-fee-'+c.id,name:'記帳費',amount:c.bookkeepingFee,note:'合成費用',createdAt:at,updatedAt:at}],payments:[],payableItems:[],accountingMissingDocs:[],accountingReturnItems:[],notes:'原始 '+c.code,scheduleHistory:[],createdAt:at,updatedAt:at})));
  for(const pc of pcs){pc.fees.push({id:pc.id+'-long-fee',name:'SYNTHETIC LONG NOTE START '+('合成長備註換行與欄寬驗證。'.repeat(8))+' END',amount:80,note:'SYNTHETIC ONLY',createdAt:at,updatedAt:at});pc.payments=pc.clientId==='synthetic-a'?[{id:pc.id+'-payment',date:'2026-03-02',amount:100,target:'auto',account:'SYNTHETIC-ONLY',note:'合成付款',createdAt:at,updatedAt:at}]:[];pc.carryInvoiceForward=true;pc.accountingMissingDocs=[{id:pc.id+'-missing',name:'合成欠缺文件',note:'SYNTHETIC',status:'pending',createdAt:at,updatedAt:at,recordedAt:at,sourcePeriodId:pc.periodId,lineageRootId:pc.id+'-missing',sourceItemId:pc.id+'-missing'}];pc.accountingReturnItems=[{id:pc.id+'-return',name:'合成待歸資料',note:'SYNTHETIC',status:'pending',createdAt:at,updatedAt:at,recordedAt:at,sourcePeriodId:pc.periodId,lineageRootId:pc.id+'-return',sourceItemId:pc.id+'-return'}];}
  const workTasks=[{id:'synthetic-task',periodId:'2026-1',clientId:'synthetic-a',name:'合成工作待辦',note:'SYNTHETIC',status:'pending',taskPlan:{date:'2026-03-05',time:'10:00'},createdAt:at,updatedAt:at}],calendarNotes=[{id:'synthetic-calendar',clientId:'synthetic-a',date:'2026-03-05',time:'10:00',content:'合成日曆記事',createdAt:at,updatedAt:at}],notifications=[{id:'synthetic-notice',periodId:'2026-1',periodClientId:'2026-1::synthetic-a',clientId:'synthetic-a',type:'receiptAsk',typeName:'合成通知',text:'SYNTHETIC notification history',content:'SYNTHETIC notification history',sentAt:at,createdAt:at}];
  await new Promise((resolve,reject)=>{const tx=db.transaction(['clients','periods','periodClients','workTasks','calendarNotes','notifications'],'readwrite');for(const [store,rows] of [['clients',clients],['periods',periods],['periodClients',pcs],['workTasks',workTasks],['calendarNotes',calendarNotes],['notifications',notifications]]){tx.objectStore(store).clear();for(const row of rows)tx.objectStore(store).put(row)}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});db.close();
 });await vatReload(p);await p.locator('#topPeriod').selectOption('2026-1');await run(p,context);
 }finally{await context.close();assert.deepEqual(evidence.pageErrors,[],'Revision and popup uncaught JavaScript errors');assert.deepEqual(evidence.blockedNetwork,[],'Revision and popup must request no external network');}
}
async function vatBackup(p){await p.locator('.nav-btn[data-view="backup"]').click();return parseJSON(await download(p,()=>p.locator('#fullBackupBtn').click()));}
async function vatWork(p){await p.locator('.nav-btn[data-view="work"]').click();await visible(p,'#workDetail');}
async function vatSave(p){await p.evaluate(()=>{window.__vatOldSaveToasts=new Set(document.querySelectorAll('.toast'))});await p.locator('#saveWorkBtn').click();await p.waitForFunction(()=>[...document.querySelectorAll('.toast')].some(x=>!window.__vatOldSaveToasts.has(x)&&x.textContent.includes('已儲存；')));}
async function vatUIRevision(p){
 await vatWork(p);const save=p.locator('#saveWorkBtn');const original=await save.elementHandle();
 assert.equal(await save.count(),1);assert.equal(await p.locator('#workSaveHost211 #saveWorkBtn').count(),1);assert.match(await p.locator('#workDetail .detail-head').innerText(),/合成測試客戶甲.*[\s\S]*1,200/);
 const dates=p.locator('#workCommonSettings .work-date211');assert.equal(await dates.count(),3);assert.match(await dates.nth(0).innerText(),/2026\/03\/10/);assert.match(await dates.nth(1).innerText(),/尚未設定[\s\S]*待設定/);assert.match(await dates.nth(1).getAttribute('class'),/is-unset/);
 assert(await dates.nth(0).evaluate(e=>{const a=getComputedStyle(e.querySelector('.work-date-value211')),b=getComputedStyle(e.querySelector('.work-date-label211'));return parseFloat(a.fontSize)>parseFloat(b.fontSize)&&Number(a.fontWeight)>=600}));
 assert(await p.locator('#workDetail .work-module-card').first().evaluate(e=>{const a=getComputedStyle(e.querySelector('.module-title')),b=getComputedStyle(e.querySelector('.module-sub'));return parseFloat(a.fontSize)>parseFloat(b.fontSize)&&Number(a.fontWeight)>Number(b.fontWeight)}));
 await vatScreenshot(p,'vat-revision-populated-work-desktop');await p.locator('#workDetail .detail-head').screenshot({path:path.join(OUT,'vat-revision-customer-header-desktop.png')});
 for(const id of ['b','a','b'])await p.locator(`[data-pcid="2026-1::synthetic-${id}"]`).click();
 assert(await save.evaluate((e,old)=>e===old,original),'Moved save control must retain its original DOM identity');assert.match(await save.getAttribute('aria-label'),/乙/);
 await p.locator('[data-work-focus="billing"]').click();assert(await p.locator('[data-focus-panel="billing"] .focus-section-heading').first().evaluate(e=>{const a=getComputedStyle(e.querySelector('.strong')),b=getComputedStyle(e.querySelector('.tiny'));return parseFloat(a.fontSize)>parseFloat(b.fontSize)&&Number(a.fontWeight)>Number(b.fontWeight)}));await p.locator('#wBookkeepingFee').fill('2468');await vatSave(p);await save.waitFor({state:'visible'});
 await p.locator('[data-focus-panel="billing"] [data-work-focus-back]').click();await p.locator('[data-work-focus="notes"]').click();await p.locator('#wNotes').fill('SYNTHETIC B saved notes');await vatSave(p);
 await p.waitForFunction(()=>!document.querySelector('#saveWorkBtn').disabled);
 let backup=await vatBackup(p),a=backup.data.periodClients.find(x=>x.id==='2026-1::synthetic-a'),b=backup.data.periodClients.find(x=>x.id==='2026-1::synthetic-b');assert.equal(a.notes,'原始 TEST-A');assert.equal(a.fees[0].amount,1200);assert.equal(b.notes,'SYNTHETIC B saved notes');assert.equal(b.fees.find(x=>x.name==='記帳費').amount,2468);
 await vatReload(p);await p.locator('#topPeriod').selectOption('2026-1');await vatWork(p);await p.locator('[data-pcid="2026-1::synthetic-b"]').click();assert.equal(await p.locator('#wNotes').inputValue(),'SYNTHETIC B saved notes');
 await p.locator('#topPeriod').selectOption('2026-2');assert(await save.isDisabled());await p.locator('#unlockPeriodBtn').click();await p.locator('#unlockReason').fill('SYNTHETIC lock regression');await p.locator('#modalRoot .modal-foot').getByRole('button',{name:'解鎖',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('#saveWorkBtn').disabled);await vatSave(p);await p.waitForFunction(()=>document.querySelector('#unlockPeriodBtn')&&!document.querySelector('#modalRoot.show')&&document.querySelector('#saveWorkBtn').disabled);
 await p.locator('#topPeriod').selectOption('2026-3');assert(await save.isDisabled());assert(await save.isHidden());assert.equal(await p.locator('#workSaveParking211 #saveWorkBtn').count(),1);assert.match(await p.locator('#workDetail').innerText(),/選擇客戶/);
 await p.locator('#topPeriod').selectOption('2026-1');await p.locator('#preShipTab').click();assert(await save.isHidden());await p.locator('#workMainTab').click();assert(await save.isVisible());
 await p.setViewportSize({width:390,height:844});await vatScreenshot(p,'vat-revision-populated-work-mobile');await p.locator('#workDetail .detail-head').scrollIntoViewIfNeeded();await vatSettle(p);await p.screenshot({path:path.join(OUT,'vat-revision-customer-header-mobile.png')});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const header=await p.locator('#workDetail .detail-head').boundingBox(),button=await save.boundingBox();assert(button&&header&&button.x>=header.x-1&&button.x+button.width<=header.x+header.width+1);
}
async function vatAccountingRevision(p){
 await p.locator('.nav-btn[data-view="accounting"]').click();const cards=p.locator('#accountingStats > .card');assert.equal(await cards.count(),4);
 const boxes=await cards.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width}}));assert(Math.max(...boxes.map(x=>x.y))-Math.min(...boxes.map(x=>x.y))<=1,'Four summary cards on one desktop row');assert(Math.max(...boxes.map(x=>x.width))-Math.min(...boxes.map(x=>x.width))<=1,'Four equal desktop widths');await vatScreenshot(p,'vat-revision-accounting-desktop');
 await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));for(let i=0;i<4;i++)assert(await cards.nth(i).evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&e.scrollWidth<=e.clientWidth+1}));await vatScreenshot(p,'vat-revision-accounting-mobile');
}

async function vatPrintOpen(p){await p.locator('.nav-btn[data-view="pdf"]').click();await p.locator('#pdfScope').selectOption('period');await p.locator('#pdfPeriod').selectOption('2026-1');await p.locator('#pdfLayoutTab212').click();await visible(p,'#pdfLayoutPanel212');}
async function vatLayoutFooter(p,label){const button=p.locator('#pdfLayoutSave212');await button.scrollIntoViewIfNeeded();await button.click({trial:true});await vatSettle(p);await p.screenshot({path:path.join(OUT,'vat-revision-layout-save-footer-'+label+'.png'),fullPage:false});}
async function vatLayoutSave(p){await p.locator('#pdfLayoutSave212').click();await p.locator('#pdfLayoutStatus212').filter({hasText:'版面已儲存'}).waitFor();assert(await p.locator('#exportPdfBtn').isEnabled());}
async function vatPreview(p){await p.locator('#pdfLayoutPreview212').click();await p.locator('#pdfLayoutPreviewBody212 .pdf-page, #pdfLayoutPreviewBody212 .task-report210').first().waitFor();await p.waitForFunction(()=>!document.querySelector('#pdfLayoutPreview212').disabled);return p.locator('#pdfLayoutPreviewBody212').innerHTML();}
function vatPdfEvidence(file,name,expected){
 const {execFileSync}=require('node:child_process'),run=(bin,args)=>execFileSync(bin,args,{encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024});
 // CI explicitly installs poppler-utils. Missing tools are a hard failure, never a skipped assertion.
 for(const bin of ['pdfinfo','pdftotext','pdftoppm'])run(bin,['-v']);
 const info=run('pdfinfo',[file]),match=info.match(/^Pages:\s+(\d+)/m);assert(match,'Poppler reports a physical PDF page count');const pages=Number(match[1]);assert(pages>=1&&pages<=40,'Synthetic print evidence has a bounded physical page count');
 const text=run('pdftotext',['-enc','UTF-8','-raw',file,'-']);fs.writeFileSync(path.join(OUT,name+'-extracted.txt'),text);const compact=text.replace(/\s/g,'');assert(compact.includes(expected.heading.replace(/\s/g,'')),'Generated PDF retains the expected heading');assert(!/修改標註|結束標註/.test(compact),'Floating annotation controls must never appear in actual generated PDF text');
 if(expected.long){assert.equal((text.match(/START/g)||[]).length,2,'Both long synthetic note starts remain in generated PDF');assert.equal((text.match(/END/g)||[]).length,2,'Both long synthetic note ends remain in generated PDF');for(const hidden of ['TEST-A','TEST-B'])assert(!text.includes(hidden),'Hidden code value must be absent from generated PDF');}
 const bbox=run('pdftotext',['-bbox-layout',file,'-']);assert.equal([...bbox.matchAll(/<page width=/g)].length,pages);assert(bbox.includes('<word '),'Generated PDF contains bounded text words');for(const page of bbox.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)){const width=Number(page[1]),height=Number(page[2]);for(const word of page[3].matchAll(/<word xMin="([\d.-]+)" yMin="([\d.-]+)" xMax="([\d.-]+)" yMax="([\d.-]+)"/g)){assert(Number(word[1])>=-1&&Number(word[3])<=width+1,'PDF text stays inside physical page width');assert(Number(word[2])>=-1&&Number(word[4])<=height+1,'PDF text stays inside physical page height');}}
 const rendered=[];for(const page of [...new Set([1,pages])]){const prefix=path.join(OUT,name+'-paper-page-'+page);run('pdftoppm',['-f',String(page),'-l',String(page),'-r','96','-singlefile','-png',file,prefix]);const stat=fs.statSync(prefix+'.png');assert(stat.size>1000&&stat.size<12*1024*1024,'Bounded nonempty actual PDF rendering');rendered.push(path.basename(prefix)+'.png')}
 return {file:path.basename(file),physicalPages:pages,rendered,verification:'Poppler text/bounds and first+last physical PDF page render; not a physical printer test; not exhaustive pagination coverage'};
}

async function vatPrintCapture(p,name){
 // Only the OS dialog is stubbed; actual production output builder still fills printRoot.
 await p.evaluate(()=>{window.__syntheticPrintCalls=0;window.print=()=>{window.__syntheticPrintCalls++}});
 const preview=await vatPreview(p);await p.locator('#exportPdfBtn').click();await p.waitForFunction(()=>window.__syntheticPrintCalls===1);
 assert.equal(await p.locator('#printRoot').innerHTML(),preview,'Saved preview and real printer HTML must be identical');
 await p.emulateMedia({media:'print'});try{assert.equal(await p.locator('#offline-review-host').evaluate(e=>getComputedStyle(e).display),'none','Floating annotation host must be hidden by real print CSS');}finally{await p.emulateMedia({media:'screen'});}
 if(name){await p.emulateMedia({media:'print'});const renderedPageLabels=await p.locator('#printRoot .pdf-foot').allTextContents();await vatScreenshot(p,name);const bytes=await p.pdf({path:path.join(OUT,name+'.pdf'),preferCSSPageSize:true,printBackground:true});assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert(bytes.length>1000);const expected=name.includes('long-note')?{heading:'本期款項／請款',long:true}:name.includes('saved-print')?{heading:'營業稅本期總表'}:name.includes('record-layout')?{heading:'客戶基本資料'}:{heading:'日曆記事'};const pdfEvidence=vatPdfEvidence(path.join(OUT,name+'.pdf'),name,expected);pdfEvidence.renderedPageLabels=renderedPageLabels;(report.pdfEvidence||=[]).push(pdfEvidence);await p.emulateMedia({media:'screen'});
 // Chromium PDF generation fires the production afterprint cleanup. Rebuild only through the explicit export UI for subsequent live-DOM assertions.
 await p.locator('#exportPdfBtn').click();await p.waitForFunction(()=>window.__syntheticPrintCalls===2);assert.equal(await p.locator('#printRoot').innerHTML(),preview,'Explicit re-export after actual afterprint cleanup must reproduce saved output');}
 return preview;
}
async function vatPrintRevision(p){
 await vatPrintOpen(p);const before=await vatPreview(p),table=p.locator('#pdfLayoutPreviewBody212 table').first(),oldHeaders=await table.locator('thead tr').last().locator('th').allTextContents();assert(oldHeaders.length>=3);
 const rows=p.locator('#pdfLayoutPanel212 [data-layout-row]');assert(await rows.count()>=3);
 await rows.nth(0).locator('[data-layout-field="visible"]').uncheck();assert(await p.locator('#exportPdfBtn').isDisabled());assert(await p.locator('#pdfLayoutPreview212').isDisabled());assert.equal(await p.locator('#pdfLayoutPreviewBody212').innerHTML(),before,'Uncommitted draft must not modify displayed saved output');
 await rows.nth(1).locator('[data-layout-field="width"]').fill('60');await rows.nth(1).locator('[data-layout-field="width"]').press('Tab');await rows.nth(1).locator('[data-layout-field="align"]').selectOption('right');await rows.nth(2).locator('[data-layout-move="-1"]').click();
 await p.locator('[data-layout-global="fontSize"]').selectOption('11');await p.locator('[data-layout-global="density"]').selectOption('relaxed');await p.locator('[data-layout-global="wrap"]').selectOption('preserve');await vatLayoutSave(p);
 const changed=await vatPrintCapture(p,'vat-revision-saved-print-browser-pdf');assert.notEqual(changed,before);
 const headers=await table.locator('thead tr').last().locator('th').allTextContents();assert(!headers.includes(oldHeaders[0]));assert(!await p.locator('#printRoot').innerText().then(t=>t.includes('TEST-A')||t.includes('TEST-B')),'Hidden code column data absent from actual print DOM');assert.equal(headers[0],oldHeaders[2]);assert.equal(headers[1],oldHeaders[1]);
 assert(await table.evaluate(t=>{const cols=[...t.querySelectorAll('col')].map(x=>parseFloat(x.style.width)),cells=[...t.tHead.rows[t.tHead.rows.length-1].cells];return cols[1]>cols[0]&&cells[1].style.textAlign==='right'&&cells.every(c=>c.style.fontSize==='11pt'&&c.style.padding==='3mm'&&c.style.whiteSpace==='pre-wrap')}));
 await vatScreenshot(p,'vat-revision-output-settings-desktop');await vatLayoutFooter(p,'desktop');await p.setViewportSize({width:390,height:844});await vatScreenshot(p,'vat-revision-output-settings-mobile');await vatLayoutFooter(p,'mobile');await p.locator('#pdfLayoutPreviewBody212').scrollIntoViewIfNeeded();await vatSettle(p);await p.screenshot({path:path.join(OUT,'vat-revision-saved-preview-mobile.png')});await p.setViewportSize({width:1440,height:1000});
 let backup=await vatBackup(p),saved=backup.data.settings[0].printLayouts212;assert.equal(saved.version,1);assert.equal(saved.profiles.period.version,1);assert.equal(saved.profiles.period.fontSize,11);assert.equal(saved.profiles.period.fields[0].visible,false);
 await vatReload(p);await vatPrintOpen(p);assert.equal(await p.locator('[data-layout-global="fontSize"]').inputValue(),'11');await p.locator('#pdfPeriod').selectOption('2026-2');await vatPrintCapture(p);assert.deepEqual(await p.locator('#printRoot table').first().locator('thead tr').last().locator('th').allTextContents(),headers,'Profile shared by two actual periods');
 await p.locator('[data-layout-global="fontSize"]').selectOption('12');await vatReload(p);await vatPrintOpen(p);assert.equal(await p.locator('[data-layout-global="fontSize"]').inputValue(),'11','Unsaved draft discarded on reload');
 await p.locator('#pdfLayoutReset212').click();assert(await p.locator('#exportPdfBtn').isDisabled());await vatLayoutSave(p);await vatReload(p);await vatPrintOpen(p);assert.equal(await p.locator('[data-layout-global="fontSize"]').inputValue(),'9');await vatPrintCapture(p);assert.deepEqual(await p.locator('#printRoot table').first().locator('thead tr').last().locator('th').allTextContents(),oldHeaders);
 backup=await vatBackup(p);assert(backup.data.settings[0].printLayouts212.profiles.period.fields.every(x=>x.visible));
 // Final period summary intentionally excludes detailed fee notes; use the real billing-detail route for long-content paper QA.
 await vatPrintOpen(p);await p.locator('#pdfScope').selectOption('section');await p.locator('#pdfSection').selectOption('billing');const detailRows=p.locator('#pdfLayoutPanel212 [data-layout-row]');await detailRows.nth(0).locator('[data-layout-field="visible"]').uncheck();await detailRows.nth(3).locator('[data-layout-field="width"]').fill('30');await detailRows.nth(3).locator('[data-layout-field="width"]').press('Tab');await p.locator('[data-layout-global="fontSize"]').selectOption('11');await p.locator('[data-layout-global="wrap"]').selectOption('preserve');await p.locator('[data-layout-global="density"]').selectOption('relaxed');await vatLayoutSave(p);await vatPrintCapture(p,'vat-revision-long-note-layout-browser-pdf');assert.equal(await p.locator('#printRoot tbody tr').count(),2);assert.match(await p.locator('#printRoot').innerText(),/SYNTHETIC LONG NOTE START/);assert(!await p.locator('#printRoot').innerText().then(t=>t.includes('TEST-A')||t.includes('TEST-B')));await vatScreenshot(p,'vat-revision-long-note-preview-desktop');

}
async function vatPrintAllScopes(p){
 await vatPrintOpen(p);
 const scopes=[['period'],['status'],['preShip'],['workTasks'],...['basic','period','yearTable','yearBlocks'].map(x=>['client',x]),...await p.locator('#pdfSection option').evaluateAll(es=>es.map(e=>['section',e.value])),['calendar']];
 for(const [scope,variant] of scopes){
  await p.locator('#pdfScope').selectOption(scope);
  if(scope==='client'){await p.locator('#pdfClient').selectOption('2026-1::synthetic-a');await p.locator('#pdfClientMode').selectOption(variant)}
  if(scope==='section')await p.locator('#pdfSection').selectOption(variant);
  if(scope==='status')await p.locator('#pdfStatus').selectOption('open');
  if(scope==='calendar'){await p.locator('#pdfCalendarFrom').fill('2026-03-01');await p.locator('#pdfCalendarTo').fill('2026-03-31');await p.locator('#pdfCalendarTo').press('Tab');}
  await p.locator('[data-layout-global="fontSize"]').selectOption('10');await vatLayoutSave(p);const html=await vatPrintCapture(p);assert(html.includes(scope==='workTasks'?'task-report210':'pdf-page'),`${scope}/${variant||''} actual print pages`);
 }
 const backup=await vatBackup(p),profiles=backup.data.settings[0].printLayouts212.profiles;
 for(const [scope,variant] of scopes){const key=scope==='status'?'period':variant?scope+'-'+variant:scope;assert.equal(profiles[key]?.fontSize,10,`Saved actual scope ${key}`);assert.equal(profiles[key]?.version,1);}
}
async function vatPrintCorrupt(p){
 // Corrupt synthetic persisted configuration only; production read/sanitize/output stays untouched.
 await p.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('VAT_WORKBENCH_DB');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite'),s=tx.objectStore('settings'),r=s.getAll();r.onsuccess=()=>{const row=r.result[0];row.printLayouts212={version:1,profiles:{period:{version:1,fontSize:999,density:'invalid',wrap:'invalid',fields:[null,{key:'evil:<script>',width:-100},{key:'c:客戶代號',width:'NaN',align:'invalid'}]},calendar:{version:1,fields:[{key:'b:月曆摘要',visible:false},{key:'b:記事明細',visible:false}]}}};s.put(row)};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});db.close()});await vatReload(p);await vatPrintOpen(p);assert.equal(await p.locator('[data-layout-global="fontSize"]').inputValue(),'9');assert.equal(await p.locator('[data-layout-global="density"]').inputValue(),'normal');assert.equal(await p.locator('[data-layout-global="wrap"]').inputValue(),'normal');await vatPrintCapture(p);assert.equal(await p.locator('#printRoot script').count(),0);assert.match(await p.locator('#printRoot').innerText(),/合成測試客戶/);await p.locator('#pdfScope').selectOption('calendar');await p.locator('#pdfCalendarFrom').fill('2026-03-01');await p.locator('#pdfCalendarTo').fill('2026-03-31');await p.locator('#pdfCalendarTo').press('Tab');await vatPrintCapture(p);assert(await p.locator('#printRoot [data-layout-block212="b:月曆摘要"]').count()>0);assert(await p.locator('#printRoot [data-layout-block212="b:記事明細"]').count()>0);assert.match(await p.locator('#printRoot').innerText(),/合成日曆記事/);
}

async function vatPrintRecordsAndBlocks(p){
 await vatPrintOpen(p);await p.locator('#pdfScope').selectOption('client');await p.locator('#pdfClient').selectOption('2026-1::synthetic-a');await p.locator('#pdfClientMode').selectOption('basic');await vatPreview(p);
 const initial=await p.locator('#pdfLayoutPreviewBody212 [data-layout-field212]').evaluateAll(es=>[...new Set(es.map(e=>e.dataset.layoutField212))]);assert(initial.length>=3,'Basic client output exposes real record pairs');const rows=p.locator('#pdfLayoutPanel212 [data-layout-row]');
 await rows.nth(0).locator('[data-layout-field="visible"]').uncheck();await rows.nth(1).locator('[data-layout-field="width"]').fill('40');await rows.nth(1).locator('[data-layout-field="width"]').press('Tab');await rows.nth(1).locator('[data-layout-field="align"]').selectOption('right');await rows.nth(2).locator('[data-layout-move="-1"]').click();await vatLayoutSave(p);await vatPrintCapture(p,'vat-revision-record-layout-browser-pdf');
 const actual=await p.locator('#printRoot [data-layout-field212]').evaluateAll(es=>[...new Set(es.map(e=>e.dataset.layoutField212))]);assert(!actual.includes(initial[0]));assert.equal(actual[0],initial[2]);assert.equal(actual[1],initial[1]);assert(await p.locator('#printRoot [data-layout-field212]').evaluateAll((es,key)=>es.filter(e=>e.dataset.layoutField212===key).every(e=>e.style.textAlign==='right'),initial[1]));
 await p.locator('#pdfClientMode').selectOption('period');await p.locator('#pdfClient').selectOption('2026-1::synthetic-a');await vatPreview(p);const recent=p.locator('#pdfLayoutPanel212 [data-layout-row]').filter({has:p.getByText('最近一筆沖銷',{exact:true})});assert.equal(await recent.count(),1);await recent.locator('[data-layout-field="visible"]').uncheck();await vatLayoutSave(p);await p.locator('#pdfClient').selectOption('2026-1::synthetic-b');await p.locator('[data-layout-global="fontSize"]').selectOption('10');await vatLayoutSave(p);await p.locator('#pdfClient').selectOption('2026-1::synthetic-a');await vatPrintCapture(p);assert.equal(await p.locator('#printRoot [data-layout-field212="r:最近一筆沖銷"]').count(),0,'Saving from a client without this conditional field must preserve its saved hidden preference');
 await p.locator('#pdfScope').selectOption('calendar');await p.locator('#pdfCalendarFrom').fill('2026-03-01');await p.locator('#pdfCalendarTo').fill('2026-03-31');await p.locator('#pdfCalendarTo').press('Tab');await vatPreview(p);
 const blocks=await p.locator('#pdfLayoutPreviewBody212 [data-layout-block212]').evaluateAll(es=>[...new Set(es.map(e=>e.dataset.layoutBlock212))]);assert(blocks.includes('b:月曆摘要'));assert(blocks.includes('b:記事明細'));
 const summary=p.locator('#pdfLayoutPanel212 [data-layout-row]').filter({hasText:'月曆摘要'});await summary.locator('[data-layout-field="visible"]').uncheck();await vatLayoutSave(p);await vatPrintCapture(p,'vat-revision-calendar-layout-browser-pdf');assert.equal(await p.locator('#printRoot [data-layout-block212="b:月曆摘要"]').count(),0);assert(await p.locator('#printRoot [data-layout-block212="b:記事明細"]').count()>0);assert.match(await p.locator('#printRoot').innerText(),/合成日曆記事/);
}

async function vatNoticeRevision(p){
 // Simulate a pre-upgrade synthetic database; custom originals and history must survive additive migration.
 await p.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('VAT_WORKBENCH_DB');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const tx=db.transaction(['settings','templates'],'readwrite'),settings=tx.objectStore('settings'),templates=tx.objectStore('templates'),r=settings.getAll();r.onsuccess=()=>{const row=r.result[0];delete row.noticeTemplates212Installed;settings.put(row)};for(const type of ['receiptAsk','collectionTomorrow211','dispatchReminder','firstBilling','finalRemit','accountingMissing'])templates.delete('notice212_'+type);templates.put({id:'receiptAsk',typeId:'receiptAsk',name:'合成既有內建修改',text:'SYNTHETIC ORIGINAL CUSTOM {客戶}',builtIn:true,enabled:true,reminders:[],createdAt:'2026-01-01T00:00:00Z'});templates.put({id:'synthetic-custom-template',typeId:'receiptAsk',name:'合成自訂原稿',text:'SYNTHETIC CUSTOM PRESERVED {客戶}',builtIn:false,enabled:true,tone:'原有測試語氣',reminders:[],createdAt:'2026-01-01T00:00:00Z'});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});db.close()});await vatReload(p);await p.locator('#topPeriod').selectOption('2026-1');await p.locator('.nav-btn[data-view="templates"]').click();
 await p.locator('#noticeGroup212').selectOption('vat');await p.locator('#noticeToneFilter212').selectOption('親切專業版');
 const vatTypes=['receiptAsk','collectionTomorrow211','dispatchReminder','firstBilling','finalRemit'];assert.deepEqual((await p.locator('#notificationTypeList [data-select-type]').evaluateAll(es=>es.map(e=>e.dataset.selectType))).sort(),[...vatTypes].sort());
 for(const type of vatTypes){await p.locator(`#notificationTypeList [data-select-type="${type}"]`).click();await p.locator(`[data-select-template="notice212_${type}"]`).click();assert.equal(await p.locator('#templateTone212').inputValue(),'親切專業版');await p.locator('#noticeClient').selectOption('2026-1::synthetic-a');await p.locator('#refreshPreviewBtn').click();const preview=await p.locator('#templatePreview').inputValue();assert.match(preview,/合成測試客戶甲/);assert.match(preview,/謝謝/);assert(!preview.includes('{客戶}'))}
 await vatScreenshot(p,'vat-revision-notice-groups-desktop');
 await p.locator('#noticeGroup212').selectOption('accounting');assert.deepEqual(await p.locator('#notificationTypeList [data-select-type]').evaluateAll(es=>es.map(e=>e.dataset.selectType)),['accountingMissing']);await p.locator('#notificationTypeList [data-select-type="accountingMissing"]').click();await p.locator('[data-select-template="notice212_accountingMissing"]').click();await p.locator('#noticeClient').selectOption('2026-1::synthetic-a');await p.locator('#refreshPreviewBtn').click();assert.match(await p.locator('#templatePreview').inputValue(),/合成欠缺文件/);
 await p.locator('[data-template-tab="export"]').click();await p.locator('#exportTemplateClearBtn').click();await p.locator('.txt-template-choice[value="notice212_accountingMissing"]').check();await p.locator('#txtClients').selectOption('2026-1::synthetic-a');const txt=await download(p,()=>p.locator('#exportTxtBtn').click());assert.match(txt.toString('utf8'),/合成測試客戶甲/);assert.match(txt.toString('utf8'),/合成欠缺文件/);
 await p.locator('[data-template-tab="manage"]').click();await p.locator('#noticeGroup212').selectOption('vat');await p.locator('#noticeToneFilter212').selectOption('');await p.locator('#notificationTypeList [data-select-type="receiptAsk"]').click();await p.locator('[data-select-template="synthetic-custom-template"]').click();assert.equal(await p.locator('#templateText').inputValue(),'SYNTHETIC CUSTOM PRESERVED {客戶}');await p.locator('#templateTone212').fill('合成溫和版');await p.locator('#saveTemplateBtn').click();await p.locator('.toast').filter({hasText:'模板已儲存'}).last().waitFor();
 await p.setViewportSize({width:390,height:844});await vatScreenshot(p,'vat-revision-notice-groups-mobile');await p.setViewportSize({width:1440,height:1000});
 let backup=await vatBackup(p);assert.equal(backup.data.templates.find(t=>t.id==='receiptAsk').text,'SYNTHETIC ORIGINAL CUSTOM {客戶}');assert.equal(backup.data.templates.find(t=>t.id==='synthetic-custom-template').text,'SYNTHETIC CUSTOM PRESERVED {客戶}');assert.equal(backup.data.notifications.find(n=>n.id==='synthetic-notice').content,'SYNTHETIC notification history');assert.equal(backup.data.settings[0].noticeTemplates212Installed,true);const count=backup.data.templates.length;
 await vatReload(p);backup=await vatBackup(p);assert.equal(backup.data.templates.length,count,'Migration idempotent after reload');assert.equal(backup.data.templates.find(t=>t.id==='synthetic-custom-template').tone,'合成溫和版');for(const type of [...vatTypes,'accountingMissing'])assert.equal(backup.data.templates.filter(t=>t.id==='notice212_'+type).length,1);assert.equal(backup.data.notifications.find(n=>n.id==='synthetic-notice').content,'SYNTHETIC notification history');
}

async function vatPreviewPaperGeometry(p){
 await vatPrintOpen(p);const fields=p.locator('#pdfLayoutPanel212 [data-layout-row]');await fields.nth(1).locator('[data-layout-field="width"]').fill('60');await fields.nth(1).locator('[data-layout-field="width"]').press('Tab');await p.locator('[data-layout-global="fontSize"]').selectOption('11');await vatLayoutSave(p);
 const measure=()=>p.locator('#pdfLayoutPreviewBody212').evaluate(container=>{const paper=container.querySelector(':scope > .pdf-page,:scope > .task-report210'),table=paper.querySelector('table'),css=getComputedStyle(paper),r=paper.getBoundingClientRect();return {orientation:container.dataset.orientation,containerWidth:container.clientWidth,scrollWidth:container.scrollWidth,overflowX:getComputedStyle(container).overflowX,paperWidth:r.width,paddingLeft:parseFloat(css.paddingLeft),paddingRight:parseFloat(css.paddingRight),tableWidth:table.getBoundingClientRect().width,cellWidths:[...table.tHead.rows[table.tHead.rows.length-1].cells].map(c=>c.getBoundingClientRect().width),cellFonts:[...table.tHead.rows[table.tHead.rows.length-1].cells].map(c=>getComputedStyle(c).fontSize),documentWidth:document.documentElement.scrollWidth,viewport:innerWidth}});
 for(const [orientation,paperMm] of [['portrait',210],['landscape',297]]){
  await p.setViewportSize({width:1440,height:1000});await p.locator('#pdfOrientation').selectOption(orientation);const savedHTML=await vatPrintCapture(p);await vatSettle(p);const desktop=await measure();
  await p.setViewportSize({width:390,height:844});await vatSettle(p);const mobile=await measure(),mm=96/25.4;
  assert.equal(mobile.orientation,orientation);assert(Math.abs(mobile.paperWidth-paperMm*mm)<1.5,'Preview paper must retain real A4 width, not shrink to phone width');assert(Math.abs(mobile.paddingLeft-10*mm)<1&&Math.abs(mobile.paddingRight-10*mm)<1,'Preview margins match the actual 10 mm print margins');assert(Math.abs(mobile.tableWidth-(paperMm-20)*mm)<2,'Preview table uses the same printable content width as PDF');
  assert(mobile.containerWidth<=390&&mobile.scrollWidth>mobile.containerWidth+100,'Narrow preview exposes a real horizontal scroll range');assert(['auto','scroll'].includes(mobile.overflowX));assert(mobile.documentWidth<=mobile.viewport+1,'Scrollable A4 preview must not widen the mobile document');assert(Math.abs(desktop.paperWidth-mobile.paperWidth)<1&&Math.abs(desktop.tableWidth-mobile.tableWidth)<1,'Paper/table dimensions remain stable across desktop and phone');assert.deepEqual(mobile.cellFonts,desktop.cellFonts);mobile.cellWidths.forEach((width,i)=>assert(Math.abs(width-desktop.cellWidths[i])<1,'Printed columns must not reflow into narrow digit columns on phone'));assert.equal(await p.locator('#pdfLayoutPreviewBody212').innerHTML(),savedHTML,'Screen-only paper geometry must not alter saved output HTML');
  const preview=p.locator('#pdfLayoutPreviewBody212');await preview.scrollIntoViewIfNeeded();await preview.evaluate(e=>e.scrollTo({left:0}));await p.waitForFunction(()=>document.querySelector('#pdfLayoutPreviewBody212')?.scrollLeft===0);await vatSettle(p);await p.screenshot({path:path.join(OUT,'vat-revision-a4-preview-'+orientation+'-mobile-left.png'),fullPage:false});
  await preview.hover();await p.mouse.wheel(1500,0);await p.waitForFunction(()=>document.querySelector('#pdfLayoutPreviewBody212')?.scrollLeft>100);await vatSettle(p);await p.screenshot({path:path.join(OUT,'vat-revision-a4-preview-'+orientation+'-mobile-right.png'),fullPage:false});
  (report.previewPaperEvidence||=[]).push({orientation,paperMm,desktop,mobile,scrollLeft:await preview.evaluate(e=>e.scrollLeft)});
 }
}

(async()=>{
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 for(const [id,flow] of [['accounting-calculator',calculator],['ledger-analyzer',ledger],['vat-workbench',vat],['pdf-workbench',pdf]]){
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000},serviceWorkers:'block'}),p=await context.newPage();p.setDefaultTimeout(15000);p.setDefaultNavigationTimeout(30000);
 const evidence={id,pageErrors:[],consoleErrors:[],blockedNetwork:[]};report.apps.push(evidence);p.on('pageerror',e=>evidence.pageErrors.push(e.message));p.on('console',m=>{if(m.type()==='error')evidence.consoleErrors.push(m.text())});
 await context.route(/^https?:/i,networkGuard(evidence));
 await check(id+' offline initial load',async()=>{const file=path.join(ROOT,'apps',id+'.html');assert(fs.existsSync(file),'Missing deliverable '+file);await p.goto(appURL(file));await visible(p,'body');assert((await p.locator('body').innerText()).length>100);assert.equal(await p.evaluate(()=>location.protocol),BASE?new URL(BASE).protocol:'file:');await screenshot(p,id+'-initial');});
 await check(id+' primary flows',()=>flow(p));
 if(id==='accounting-calculator')await check(id+' populated tax readability + labels + insurance copy at desktop and mobile',()=>calculatorPresentation(p));
 if(id==='accounting-calculator')await check(id+' multiline equations + bidirectional ratios + invalid inputs + unchanged keypad',()=>calculatorMathTools(p));
 if(id==='accounting-calculator')await check(id+' number-pool exact/nearby groups + import + modes + names + mobile + Worker cancellation',()=>calculatorPool(p));
 await check(id+' feedback visible blocks + export + reload + mobile',()=>feedback(p,id));
 await check(id+' floating feedback drag + persistence + keyboard + resize + reset',()=>floatingPanel(p,id));
 await check(id+' mobile controls reachable without clipping or toggle overlap',()=>mobileLayout(p,id));
 if(id==='pdf-workbench')await check(id+' native modal feedback reachability + business-click protection',()=>nativeDialogFeedback(p));
 await check(id+' no uncaught JavaScript errors',()=>assert.deepEqual(evidence.pageErrors,[]));
 await check(id+' no external network requested',()=>assert.deepEqual(evidence.blockedNetwork,[]));
 // Console error diagnostics retained, not treated as uncaught exceptions.
 await context.close();
 }
 await check('vat revision populated dates + save identity + persistence + locking + mobile',()=>vatRevisionContext(vatUIRevision));
 await check('vat revision accounting four-card desktop + phone geometry',()=>vatRevisionContext(vatAccountingRevision));
 await check('vat saved print layout actual output + explicit save + reload + shared periods + defaults + backup',()=>vatRevisionContext(vatPrintRevision));
 await check('vat saved print layout every scope uses actual printer HTML',()=>vatRevisionContext(vatPrintAllScopes));
 await check('vat A4 preview portrait/landscape paper width + phone scrolling without reflow',()=>vatRevisionContext(vatPreviewPaperGeometry));
 await check('vat saved print record-pair and calendar-block visibility/order/width in real output',()=>vatRevisionContext(vatPrintRecordsAndBlocks));
 await check('vat saved print layout corrupt synthetic profile gracefully sanitized',()=>vatRevisionContext(vatPrintCorrupt));
 await check('vat grouped notice UI + actual preview/TXT + additive migration preserves custom/history + reload',()=>vatRevisionContext(vatNoticeRevision));
 await check('four tools floating feedback real touch movement + save',floatingTouch);
 for(const kind of ['unavailable','quota'])await check('feedback '+kind+' storage retains exportable in-memory note',()=>storageFailure(kind));
})().catch(e=>{report.checks.push({name:'test infrastructure',status:'fail',error:String(e.stack||e)});console.error(e)}).finally(async()=>{if(browser)await browser.close();report.finishedAt=new Date().toISOString();report.pass=report.checks.filter(x=>x.status==='pass').length;report.fail=report.checks.filter(x=>x.status==='fail').length;fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log(`${report.pass} passed, ${report.fail} failed`);process.exitCode=report.fail?1:0});
