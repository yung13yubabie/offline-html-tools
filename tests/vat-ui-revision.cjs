// Portable source/pure rendering regressions. Browser layout remains a separate CI check.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../apps/vat-workbench.html'),'utf8');
let checks=0;const check=(fn)=>{fn();checks++};
for(const [,script] of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(script.trim())new vm.Script(script);
const nodes={};
function node(id){return nodes[id]={id,disabled:false,attributes:{},parentNode:null,children:[],classList:{values:new Set(),toggle(k,on){on?this.values.add(k):this.values.delete(k)}},setAttribute(k,v){this.attributes[k]=v},appendChild(child){if(child.parentNode)child.parentNode.children=child.parentNode.children.filter(x=>x!==child);child.parentNode=this;this.children.push(child)},prepend(child){this.appendChild(child)}}}
const parking=node('workSaveParking211'),button=node('saveWorkBtn'),detail=node('workDetail');parking.appendChild(button);
Object.defineProperty(detail,'innerHTML',{set(html){this.html=html;const old=nodes.workSaveHost211;if(old?.children.includes(button))delete nodes.saveWorkBtn;delete nodes.workSaveHost211;if(html.includes('id="workSaveHost211"'))node('workSaveHost211')},get(){return this.html}});
const period={id:'synthetic-period',status:'進行中',year:2026,slot:1,latestRemitDate:'2026-03-10',latestDispatchDate:'',dueDate:'2026-03-15'};
const clients=[{id:'pc-a',clientId:'c-a',periodId:period.id,snapshot:{name:'合成客戶甲',code:'TEST-A',bookkeepingFee:1200},notes:'甲原始'},{id:'pc-b',clientId:'c-b',periodId:period.id,snapshot:{name:'合成客戶乙',code:'TEST-B',bookkeepingFee:2400},notes:'乙原始'}];
const state={periodClients:clients,selectedPCId:'pc-a',workTab:'main'};
const ctx={state,$:s=>nodes[s.slice(1)],esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),fmtDate:x=>x,currentPeriod:()=>period,clone:structuredClone,clientById:()=>null,money:x=>String(x),contactSummary:()=>'',workPortfolioStripV24:()=>'',moduleSummaryGridV24:()=>'<div id="workModuleGrid"></div>',workFocusPanelsV24:()=>'<div id="workFocusPanels"></div>',bindWorkDetail:(pc,p,locked)=>{nodes.saveWorkBtn.disabled=locked},applyWorkFocusV24:()=>{},savingWork210:false};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('function workDateBadge211'),source.indexOf('function renderWork(){')),ctx);
vm.runInContext(source.slice(source.indexOf('renderWorkDetail=function(){const pc='),source.indexOf('\nfunction applyWorkFocusV24')),ctx);
check(()=>{assert.equal((source.match(/id="saveWorkBtn"/g)||[]).length,1);assert(!source.match(/<div class="page-head">[^\n]*id="saveWorkBtn"/));assert(source.includes("$('#saveWorkBtn').onclick=saveWorkDraft"))});
check(()=>{const html=ctx.workDateBadge211('最晚匯款',period.latestRemitDate);assert.match(html,/is-set/);assert.match(html,/2026-03-10/);assert.match(html,/已設定/);assert(!html.includes('逾期'))});
check(()=>{const html=ctx.workDateBadge211('最晚寄出','');assert.match(html,/is-unset/);assert.match(html,/尚未設定/);assert.match(html,/待設定/)});
check(()=>assert.match(ctx.workDateBadge211('法定繳款',period.dueDate,'依法定期限'),/依法定期限/));
let clickedId=null;button.onclick=()=>{clickedId=state.workDraft.id};const originalListener=button.onclick;
check(()=>{ctx.renderWorkDetail();assert.equal(nodes.saveWorkBtn,button);assert.equal(button.parentNode,nodes.workSaveHost211);assert.match(detail.innerHTML,/合成客戶甲/);assert.match(detail.innerHTML,/1200 元/);assert.equal(button.disabled,false);assert.match(button.attributes['aria-label'],/合成客戶甲/);button.onclick();assert.equal(clickedId,'pc-a')});
check(()=>{ctx.renderWorkDetail();assert.equal(nodes.saveWorkBtn,button);assert.equal(button.onclick,originalListener);assert.equal(button.parentNode.children.filter(x=>x===button).length,1)});
check(()=>{state.selectedPCId='pc-b';ctx.renderWorkDetail();button.onclick();assert.equal(clickedId,'pc-b');assert.match(detail.innerHTML,/2400 元/);assert.match(button.attributes['aria-label'],/合成客戶乙/)});
check(()=>{period.status='已結束';ctx.renderWorkDetail();assert.equal(button.disabled,true);assert.match(detail.innerHTML,/unlockPeriodBtn/)});
check(()=>{period.unlocked=true;ctx.renderWorkDetail();assert.equal(button.disabled,false)});
check(()=>{state.workTab='preShip';ctx.renderWorkDetail();assert(button.classList.values.has('hidden'));state.workTab='fees';ctx.renderWorkDetail();assert(button.classList.values.has('hidden'));state.workTab='main';ctx.renderWorkDetail();assert(!button.classList.values.has('hidden'))});
check(()=>{state.selectedPCId=null;ctx.renderWorkDetail();assert.equal(button.parentNode,parking);assert.equal(button.disabled,true);assert.equal(state.workDraft,null);assert.equal(nodes.saveWorkBtn,button);assert(!nodes.workSaveHost211)});
check(()=>{state.selectedPCId='pc-a';ctx.renderWorkDetail();assert.equal(button.parentNode,nodes.workSaveHost211);assert.equal(button.onclick,originalListener)});
check(()=>{const original=ctx.currentPeriod;ctx.currentPeriod=()=>null;ctx.renderWorkDetail();assert.equal(button.parentNode,parking);assert.equal(state.workDraft,null);assert.equal(button.disabled,true);ctx.currentPeriod=original;ctx.renderWorkDetail()});
check(()=>{assert.match(source,/#accountingStats\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);assert.match(source,/@media screen and \(max-width:1100px\).*#accountingStats\{grid-template-columns:repeat\(2/);assert.match(source,/@media screen and \(max-width:520px\).*#accountingStats\{grid-template-columns:1fr/)});
check(()=>{for(const id of ['workCommonSettings','workDetail','accountingStats'])assert(source.includes(`data-review-id="vat-workbench-${id}"`));assert.match(source,/#workDetail \.focus-section-heading \.strong\{font-size:16px;font-weight:750/);assert.match(source,/#workDetail \.focus-section-heading \.tiny\{font-size:13px;font-weight:400/)});
// Execute the production final save function with synthetic persistence, ensuring identity and re-lock state.
Object.assign(ctx,{captureWorkForm210:()=>{state.workDraft.notes='乙已編輯'},persistWork210:async pc=>{assert.equal(pc.id,'pc-b');clients[1]=pc;period.unlocked=false;return pc},workSignature210:JSON.stringify,logTransitions:async()=>{},loadAll:async()=>ctx.renderWorkDetail(),toast:()=>{},console});state.periods=[period];
vm.runInContext(source.slice(source.indexOf('saveWorkDraft=async function(){if(!state.workDraft||savingWork210)'),source.indexOf('\n',source.indexOf('saveWorkDraft=async function(){if(!state.workDraft||savingWork210)'))),ctx);
(async()=>{state.selectedPCId='pc-b';period.unlocked=true;ctx.renderWorkDetail();button.onclick=ctx.saveWorkDraft;await button.onclick();check(()=>{assert.equal(clients[1].notes,'乙已編輯');assert.equal(clients[0].notes,'甲原始');assert.equal(button.disabled,true);assert.equal(button.parentNode,nodes.workSaveHost211);assert.equal(ctx.savingWork210,false)});console.log(`${checks} VAT UI revision checks passed (synthetic DOM/persistence; not a visual browser test).`);})().catch(e=>{console.error(e);process.exitCode=1});
