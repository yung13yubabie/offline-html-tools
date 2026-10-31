// Synthetic-only portable tests; browser interactions run separately in browser-smoke.cjs.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(process.env.VAT_APP||path.join(__dirname,'../apps/vat-workbench.html'),'utf8');
for(const [,js] of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(js.trim())new vm.Script(js);
let checks=0;const check=fn=>{fn();checks++},plain=x=>JSON.parse(JSON.stringify(x));
const start=source.indexOf('const NOTICE_TONE212='),end=source.indexOf('const seedNoticesBefore212=',start);
assert(start>0&&end>start);
const ctx={nowISO:()=> '2026-01-01T00:00:00Z'};vm.createContext(ctx);vm.runInContext(source.slice(start,end)+'\nglobalThis.specs=NOTICE_SPECS212;',ctx);
const types=ctx.specs.map(s=>({id:s.id,name:s.old,builtIn:true,enabled:true}));
const templates=ctx.specs.map(s=>({id:s.id==='collectionTomorrow211'?'collectionTomorrow211_default':s.id==='accountingMissing'?'accountingMissingDefault':s.id,typeId:s.id,text:'USER EDIT '+s.id,name:'My saved version',tone:'客製語氣',builtIn:true,enabled:true,remindersEnabled:true,reminders:[{id:'test-rem',days:2}]}));
types.push({id:'custom-type',name:'我的通知',noticeGroup212:'legacy-group'});templates.push({id:'custom-template',typeId:'custom-type',name:'Custom',text:'DO NOT CHANGE',tone:'自訂語氣'});
const history=[{id:'synthetic-notice',typeId:'firstBilling',templateId:'firstBilling',content:'saved historical message'}],before=JSON.stringify({types,templates,history});
const settings={id:'main',preferredNoticeTone212:'自訂語氣'},ops=ctx.noticeMigration212(types,templates,settings,false);
check(()=>assert.equal(JSON.stringify({types,templates,history}),before));
check(()=>assert.equal(ops.filter(x=>x.store==='templates').length,6));
check(()=>assert(ops.filter(x=>x.store==='templates').every(x=>x.value.id.startsWith('notice212_')&&x.value.tone==='親切專業版')));
check(()=>assert(!ops.some(x=>x.store==='notifications')));
check(()=>assert(!ops.some(x=>x.store==='templates'&&templates.some(t=>t.id===x.value.id))));
check(()=>assert(!ops.some(x=>x.store==='notificationTypes'&&x.value.id==='custom-type')));
check(()=>assert.equal(ops.find(x=>x.store==='settings').value.preferredNoticeTone212,'自訂語氣'));
check(()=>assert.equal(ctx.noticeMigration212(types,templates,ops.find(x=>x.store==='settings').value,false).length,0));
const customNamed=types.map(x=>({...x,name:'User named '+x.id}));
check(()=>assert(ctx.noticeMigration212(customNamed,templates,settings,false).filter(x=>x.store==='notificationTypes').every(x=>x.value.name.startsWith('User named'))));
const fresh=ctx.noticeMigration212(types.slice(0,6),templates.slice(0,6),{id:'main'},true).filter(x=>x.store==='templates');
check(()=>assert.equal(fresh.length,6));
check(()=>assert(fresh.every(x=>!x.value.id.startsWith('notice212_')&&x.value.text!=='USER EDIT '+x.value.typeId)));
check(()=>assert(fresh.every(x=>x.value.reminders[0].id==='test-rem')));
check(()=>assert(ctx.specs.filter(s=>s.group==='vat').length===5&&ctx.specs.filter(s=>s.group==='accounting').length===1));
check(()=>assert(!ctx.specs.some(s=>/銀行|帳號|罰|法律|滯納/.test(s.text))));
// Execute the actual production interpolation function with synthetic contexts.
const line=prefix=>source.split('\n').find(x=>x.startsWith(prefix));
Object.assign(ctx,{currentPC:()=>({}),currentPeriod:()=>({}),money:x=>String(x),paidTotal:()=>0,debt:()=>90,totalDue:()=>100,fmtDate:x=>x,applySequentialOtherTokens:x=>x,templateContext:()=>({客戶:'合成甲',聯繫人:'測試人',年度:2026,期別:'1-2月',應付總額:100,尚欠金額:90,最晚匯款日:'2026-03-12',最晚寄出日:'2026-03-05',預約收發票日:'2026-03-04',收發票備註:'合成備註',欠缺文件明細:'・合成收據',otherFees:[],bookkeeping:0})});
vm.runInContext(line('const VARS=')+"\nVARS.push('欠缺文件明細','預約收發票日','收發票備註');\n"+line('function applyTemplate(type,text,'),ctx);
for(const s of ctx.specs)check(()=>{const text=ctx.applyTemplate(s.id,s.text,{},{});assert(!/\{[^}]+\}/.test(text));assert(text.includes('合成甲'));});
check(()=>assert(ctx.applyTemplate('accountingMissing',ctx.specs[5].text,{},{}).includes('合成收據')));
Object.assign(ctx,{accPendingDocs:pc=>(pc.docs||[]).filter(x=>x.status!=='done'),accMissingText:pc=>(pc.docs||[]).filter(x=>x.status!=='done').map(x=>'・'+x.name).join('\n'),dispatchDate:(pc,p)=>p.latestDispatchDate||''});
vm.runInContext(source.slice(source.indexOf('const noticeContextBefore212='),source.indexOf('\nrenderExportTemplates=function()',source.indexOf('const noticeContextBefore212='))),ctx);
check(()=>assert.equal(ctx.templateContext({docs:[]},{}).欠缺文件明細,'目前沒有待補文件。'));
check(()=>assert.equal(ctx.templateContext({docs:[{name:'Pending',status:'pending'},{name:'Finished',status:'done'}]},{}).欠缺文件明細,'・Pending'));
check(()=>assert.equal(ctx.templateContext({},{}).最晚匯款日,'尚未設定'));
// Test saved TXT bodies from multiple selections, not the unsaved editor buffer.
const downloads=[],newTemplates=ops.filter(x=>x.store==='templates').map(x=>x.value),ids=[newTemplates[0].id,newTemplates[5].id];
Object.assign(ctx,{currentPeriod:()=>({id:'p'}),$$:()=>ids.map(value=>({value})),$:()=>({selectedOptions:[{value:'pc-a'},{value:'pc-b'}]}),state:{periodClients:[{id:'pc-a'},{id:'pc-b'}]},templateById:id=>newTemplates.find(t=>t.id===id),notificationTypeName:id=>id,safeFileName:x=>x,periodLabel:()=> 'Synthetic',localDate:()=> '2026-01-01',Blob,downloadBlob:(blob,name)=>downloads.push({blob,name}),toast:()=>{}});
vm.runInContext(line('function exportTemplateTxt(){const p=currentPeriod();if(!p){toast(\'請先選擇期別\');return}const tplIds='),ctx);
ctx.exportTemplateTxt();
check(()=>assert.equal(downloads.length,2));
(async()=>{for(const d of downloads){const text=await d.blob.text();check(()=>assert.equal(text.split('----------------------------------------').length,2));check(()=>assert(!/\{[^}]+\}/.test(text)));}
// Unknown stored groups remain discoverable under Other/Custom without mutating their metadata.
ctx.state={noticeGroupFilter212:'custom'};vm.runInContext(line('function noticeTypeVisible212(nt)'),ctx);
check(()=>assert.equal(ctx.noticeTypeVisible212({id:'custom-type',noticeGroup212:'legacy-group'}),true));
check(()=>assert.equal(ctx.noticeTypeVisible212({id:'receiptAsk'}),false));
// Run the actual editor save path and its tone hook against a synthetic persistence sink.
const saved=[],edit={id:'custom-edit',typeId:'firstBilling',name:'Before',text:'Before',tone:'原有語氣'};
const inputs={'#templateName':{value:'Saved name'},'#templateText':{value:'Synthetic saved body'},'#templateEnabled':{checked:true},'#templateTone212':{value:'自訂禮貌語氣'}};
Object.assign(ctx,{$:id=>inputs[id],selectedTemplate:()=>edit,put:async(store,row)=>saved.push({store,row:plain(row)}),loadAll:async()=>{},state:{},toast:()=>{}});
vm.runInContext(line('async function saveTemplate(){const t=selectedTemplate();')+'\n'+source.slice(source.indexOf('const saveNoticesBefore212='),source.indexOf('BUILTIN_TEMPLATE_TEXT[ACCOUNT_MISSING_TYPE]=',source.indexOf('const saveNoticesBefore212='))),ctx);
await ctx.saveTemplate();
check(()=>assert.equal(saved[0].row.tone,'自訂禮貌語氣'));
check(()=>assert.equal(saved[0].row.text,'Synthetic saved body'));
check(()=>assert.equal(ctx.state.selectedTemplateId,'custom-edit'));
check(()=>assert(source.includes("typeId:src.typeId,name,text:src.text||'',tone:noticeTone212(src),builtIn:false")));
console.log(`${checks} VAT notice checks passed (synthetic pure migration/interpolation/TXT/editor; browser QA separate).`);
})().catch(e=>{console.error(e);process.exitCode=1});
