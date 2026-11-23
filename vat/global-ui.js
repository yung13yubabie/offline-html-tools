/* VAT 2.17 global composition: preserve bound inputs/buttons and financial state. */
function vatHelp217(root=document){
 const selector='.section-subtitle,.work-focus-sub,#view-work .billing-completion210:not(.done),#salesRevenueHelp214,#view-work .tax-other-sub,.tax-linked-note,.tax-register-source,.tax-other-sub,.motion-description211,.template-inline-hint211:not(.is-warning),.page-sub:not([id]),.fee-header211>div>p';
 root.querySelectorAll(selector).forEach(node=>{
  if(node.closest('.vat-help217,.pdf-paper217,#pdfLayoutPreviewBody212')||!node.textContent.trim())return;
  const work=node.closest('#view-work'),disclosure=vatElement214('details','vat-help217'),summary=vatElement214('summary','',work?'?':'說明');
  if(work){summary.title=node.textContent.trim();summary.setAttribute('aria-label','操作說明');}
  node.before(disclosure);disclosure.append(summary,node);
 });
}
function vatWorkCompose217(){
 const detail=$('#workDetail'),head=detail?.querySelector('.detail-head'),host=$('#workSaveHost211');
 if(!detail||!head||!host||head.dataset.composed217==='1')return;head.dataset.composed217='1';
 const footer=vatElement214('footer','vat-work-footer217');footer.id='workFooter217';
 const pc=state.periodClients.find(x=>x.id===state.selectedPCId),p=currentPeriod();
 footer.append(vatElement214('span','',`${pc?.snapshot?.name||'目前客戶'} · ${p?periodLabel(p):''}`),host);detail.append(footer);
 const tabs=$('#workModuleGrid');if(tabs){tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','本期工作項目');}
 $$('[data-work-focus]').forEach((b,i)=>{b.setAttribute('role','tab');b.id='workTab217-'+b.dataset.workFocus;b.setAttribute('aria-controls','workPanel217-'+b.dataset.workFocus);b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const all=$$('[data-work-focus]');const n=e.key==='Home'?0:e.key==='End'?all.length-1:(i+(e.key==='ArrowRight'?1:-1)+all.length)%all.length;all[n].focus();all[n].click();});});
 $$('[data-focus-panel]').forEach(panel=>{panel.id='workPanel217-'+panel.dataset.focusPanel;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','workTab217-'+panel.dataset.focusPanel);});
 applyWorkFocusV24(state.workFocusSection,false);vatHelp217(detail);
}
const vatWorkRenderBefore217=renderWorkDetail;
renderWorkDetail=function(){const result=vatWorkRenderBefore217();vatWorkCompose217();return result;};
applyWorkFocusV24=function(id,scroll=true){
 const selected=({notes:'receipt',carry:'billing'}[id]||id||'receipt');state.workFocusSection=selected;
 $('#workModuleGrid')?.classList.remove('focus-hidden');$('#workFocusPanels')?.classList.add('active');
 $$('[data-focus-panel]').forEach(x=>x.classList.toggle('active',x.dataset.focusPanel===selected));
 $$('[data-work-focus]').forEach(b=>{const active=b.dataset.workFocus===selected;b.classList.toggle('is-current217',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
 if(scroll)$('#workModuleGrid')?.scrollIntoView({behavior:'auto',block:'nearest'});
};
function vatGlobalMount217(){
 document.body.classList.add('vat-ui217');
 const nav=$('.sidebar'),groups=[['每日處理',['today','calendar','cases','contracts','work','accounting']],['資料與輸出',['clients','templates','pdf']],['管理',['backup','settings']]];
 const nodes=new Map($$('.sidebar .nav-btn').map(b=>[b.dataset.view,b]));nodes.get('pdf').querySelector('span:last-child').textContent='列印編輯';
 nav.querySelectorAll('.nav-section-label,.side-divider').forEach(n=>n.remove());
 for(const [name,ids]of groups){nav.append(vatElement214('div','nav-section-label',name));for(const id of ids){const b=nodes.get(id);if(b){b.setAttribute('aria-label',b.textContent.trim());b.title=b.textContent.trim();nav.append(b);}}}
 nav.setAttribute('aria-label','營業稅工作台主導覽');
 $('#globalSearch')?.setAttribute('aria-label','搜尋全部客戶');
 // Settings becomes a category workspace; existing controls and save behavior are retained.
 const settings=$('#view-settings'),grid=settings?.querySelector(':scope>.grid');
 if(grid){const cards=[...grid.children],nav=vatElement214('nav','vat-settings-nav217');nav.setAttribute('aria-label','設定分類');grid.before(nav);grid.classList.add('vat-settings-content217');
  cards.forEach((card,i)=>{const title=card.querySelector('.card-h')?.textContent.trim()||`設定 ${i+1}`,b=vatElement214('button','btn',title);b.type='button';b.setAttribute('aria-controls','settingPanel217-'+i);card.id='settingPanel217-'+i;b.onclick=()=>{cards.forEach((c,j)=>c.hidden=j!==i);[...nav.children].forEach((n,j)=>{n.classList.toggle('active',j===i);n.setAttribute('aria-pressed',String(j===i));});};nav.append(b);});nav.firstElementChild?.click();
 }
 // Restore stays visually separated from export and keeps its safety text visible.
 $('#view-backup')?.querySelectorAll(':scope>.grid>.card').forEach((card,i)=>{const h=card.querySelector('.card-h');if(h)h.dataset.step217=String(i+1);});
 vatWorkCompose217();vatHelp217();
 const observer=new MutationObserver(records=>{const roots=new Set();for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1&&!n.closest('.vat-help217,.pdf-paper217,#printRoot'))roots.add(n);for(const n of roots)vatHelp217(n);});
 observer.observe($('.app'),{subtree:true,childList:true});
}
const vatSwitchBefore217=switchView;
switchView=function(v){const result=vatSwitchBefore217(v);$$('.sidebar .nav-btn').forEach(b=>{if(b.dataset.view===state.view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});return result;};
const vatWireBefore217=wire;
wire=function(){vatWireBefore217();vatGlobalMount217();};
