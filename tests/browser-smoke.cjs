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
 await check(id+' feedback visible blocks + export + reload + mobile',()=>feedback(p,id));
 if(id==='pdf-workbench')await check(id+' native modal feedback reachability + business-click protection',()=>nativeDialogFeedback(p));
 await check(id+' no uncaught JavaScript errors',()=>assert.deepEqual(evidence.pageErrors,[]));
 await check(id+' no external network requested',()=>assert.deepEqual(evidence.blockedNetwork,[]));
 // Console error diagnostics retained, not treated as uncaught exceptions.
 await context.close();
 }
 for(const kind of ['unavailable','quota'])await check('feedback '+kind+' storage retains exportable in-memory note',()=>storageFailure(kind));
})().catch(e=>{report.checks.push({name:'test infrastructure',status:'fail',error:String(e.stack||e)});console.error(e)}).finally(async()=>{if(browser)await browser.close();report.finishedAt=new Date().toISOString();report.pass=report.checks.filter(x=>x.status==='pass').length;report.fail=report.checks.filter(x=>x.status==='fail').length;fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log(`${report.pass} passed, ${report.fail} failed`);process.exitCode=report.fail?1:0});
