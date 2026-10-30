// Control-flow safeguards only. Does not claim PDF rendering fidelity testing.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const s=fs.readFileSync(path.join(__dirname,'../apps/pdf-workbench.html'),'utf8');
const fn=s.slice(s.indexOf('async function runPdfToImages()'),s.indexOf('\n',s.indexOf('async function runPdfToImages()')));
assert(s.includes('id="pdfImageLimitNotice"'));assert(s.includes('混合頁面即使輸出成功也不能視為內容完整'));
assert(s.includes("pageImagePreview(page,maxDim=1400)"));
(async()=>{
 let confirmed=0,warned=0,started=0;const ctx={imageExportScopePages:()=>[{page:{kind:'pdf'},index:0}],confirm:()=>{confirmed++;return false},warn:()=>warned++,setBusy:()=>started++,toast:()=>{},$:()=>{throw Error('export should not start')}};vm.createContext(ctx);vm.runInContext(fn,ctx);await ctx.runPdfToImages();assert.equal(confirmed,1);assert.equal(warned,0);assert.equal(started,0);
 ctx.imageExportScopePages=()=>[];await ctx.runPdfToImages();assert.equal(confirmed,1);
 console.log('PASS PDF extraction limitation notice and cancellation-before-export safeguards (synthetic control-flow)');
})().catch(e=>{console.error(e);process.exitCode=1});
