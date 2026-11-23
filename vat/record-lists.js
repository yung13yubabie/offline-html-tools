/* Shared client folders and compact record details for cases and contracts. */
function recordFacts220(facts) {
 const values=facts.filter(([,value])=>value&&String(value).trim()&&value!=='—');
 if(!values.length)return '';
 return `<dl class="record-facts220">${values.map(([label,value])=>
  `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
}
function recordClientFacts222(client) {
 return client?recordFacts220([['聯絡人',contactSummary(client)],['地址',client.address]]):'';
}
function recordTimeline224(schedule){
 const values=(schedule||[]).filter(([,value])=>value&&value!=='—').sort((a,b)=>a[2].localeCompare(b[2]));
 if(!values.length)return '';
 return `<ol class="record-timeline224" aria-label="重要日期">${values.map(([label,value])=>
  `<li><span aria-hidden="true" class="record-node224"></span><div><span>${esc(label)}</span><strong>${esc(value)}</strong></div></li>`).join('')}</ol>`;
}
function buildRecordRows222(rows,columns,expanded,prefix) {
 return rows.map((row,index)=>{
  const detailId=prefix+'-detail-'+index,open=expanded.has(row.id);
  const toggle=`<button class="btn record-detail-toggle222" type="button" data-record-toggle222="${esc(row.id)}" aria-controls="${detailId}" aria-expanded="${open}">明細</button>`;
  return `<article role="listitem" class="record-item220" ${row.keyAttribute}="${esc(row.id)}">
   <div class="record-row220">${row.cells.map((content,cell)=>
    `<div class="record-cell220"><span class="record-label222">${esc(columns[cell])}</span>${content}${cell===row.cells.length-1?toggle:''}</div>`).join('')}</div>
   <div id="${detailId}" class="record-detail-body222" ${open?'':'hidden'}>
    ${recordTimeline224(row.schedule)}
    ${row.extra||''}
    ${recordFacts220(row.facts)}
    ${row.note?.trim()?`<div class="record-note222"><strong>備註</strong><p>${esc(row.note)}</p></div>`:''}
    ${row.meta?.length?`<div class="record-audit222">${row.meta.map(([label,value])=>`<span>${esc(label)} ${esc(value)}</span>`).join('')}</div>`:''}
    ${row.detailActions||''}
   </div>
  </article>`;
 }).join('');
}
function recordReveal222(body) {
 if(!motionEnabled211())return;
 body.getAnimations().forEach(animation=>animation.cancel());
 const ease='cubic-bezier(.2,.72,.22,1)';
 if(!body.matches('.record-detail-body222')){
  body.animate([{opacity:.82,transform:'translateY(-4px)'},{opacity:1,transform:'translateY(0)'}],{duration:160,easing:ease});
  return;
 }
 body.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
 body.animate([{opacity:.72,transform:'translateY(-5px)'},{opacity:1,transform:'translateY(0)'}],{duration:225,easing:ease});
 body.querySelectorAll('.record-timeline224 li').forEach((item,index)=>{
  item.animate([{opacity:.45,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],
   {duration:190,delay:index*36,easing:ease,fill:'backwards'});
 });
}
function bindRecordDetails222(host,expanded) {
 host.querySelectorAll('[data-record-toggle222]').forEach(button=>{
  const body=document.getElementById(button.getAttribute('aria-controls'));
  button.onclick=()=>{
   const open=body.hidden;
   button.setAttribute('aria-expanded',String(open));
   body.hidden=!open;
   if(open){expanded.add(button.dataset.recordToggle222);recordReveal222(body);}
   else expanded.delete(button.dataset.recordToggle222);
  };
 });
}
function recordCounts222(records) {
 const counts=new Map();
 for(const row of records)counts.set(row.clientId,(counts.get(row.clientId)||0)+1);
 return counts;
}
function clientFolders222({host,pager,runtime,matched,all,kind,columns,makeRow,render,bind}) {
 host.querySelectorAll('[data-client-folder222]').forEach(folder=>{
  if(folder.open!==(folder.dataset.initialOpen==='true'))runtime.folders.set(folder.dataset.clientFolder222,folder.open);
 });
 const groups=new Map();
 for(const row of matched){
  if(!groups.has(row.clientId))groups.set(row.clientId,[]);
  groups.get(row.clientId).push(row);
 }
 const clients=new Map(state.clients.map(client=>[client.id,client]));
 const totals=recordCounts222(all);
 const otherCounts=recordCounts222(kind==='案件'?state.contracts||[]:state.cases||[]);
 const otherKind=kind==='案件'?'合約':'案件';
 const folders=[...groups].sort(([a],[b])=>{
  const label=id=>clients.get(id)?.code||clients.get(id)?.name||id;
  return label(a).localeCompare(label(b),'zh-Hant',{numeric:true})||a.localeCompare(b);
 });
 runtime.page=Math.max(1,Math.min(runtime.page,Math.ceil(folders.length/runtime.size)));
 const visible=folders.slice((runtime.page-1)*runtime.size,runtime.page*runtime.size);
 if(!visible.length){
  host.innerHTML=`<div class="empty">${all.length?'沒有符合條件的'+kind:'尚無'+kind}</div>`;
 }else{
  host.innerHTML=`<div class="record-list220" aria-label="${esc(kind)}客戶">
   ${visible.map(([clientId,rows])=>{
    const customer=clients.get(clientId),total=totals.get(clientId),other=otherCounts.get(clientId);
    const count=rows.length===total?String(total):rows.length+' / '+total;
    const open=runtime.folders.get(clientId)??folders.length===1;
    return `<details class="client-folder222" data-client-folder222="${esc(clientId)}" data-initial-open="${open}" ${open?'open':''}>
     <summary><span class="folder-title222"><strong>${esc(customer?.name||'客戶已移除')}</strong>${customer?.code?`<small>${esc(customer.code)}</small>`:''}</span>
      <span class="folder-counts222"><span class="folder-count222" aria-label="${esc(kind)}符合 ${rows.length} 筆，共 ${total} 筆">${count} ${esc(kind)}</span>
      ${other?`<span class="folder-cross-count222">${other} ${otherKind}</span>`:''}</span></summary>
     <div class="folder-body222"></div>
    </details>`;
   }).join('')}
  </div>`;
 }
 host.querySelectorAll('[data-client-folder222]').forEach((folder,folderIndex)=>{
  const clientId=folder.dataset.clientFolder222,records=groups.get(clientId),body=folder.querySelector('.folder-body222');
  const mount=()=>{
   if(body.childElementCount)return;
   const limit=Math.min(runtime.limits.get(clientId)||12,records.length);
   const contact=recordClientFacts222(clients.get(clientId));
   body.innerHTML=`${contact?`<div class="folder-contact222">${contact}</div>`:''}
    <div role="list">${buildRecordRows222(records.slice(0,limit).map(makeRow),columns,runtime.expanded,host.id+'-'+folderIndex)}</div>
    ${limit<records.length?`<div class="folder-more222"><button class="btn" type="button" data-folder-more222>再顯示 ${Math.min(12,records.length-limit)} 筆</button></div>`:''}`;
   bindRecordDetails222(body,runtime.expanded);
   bind(body);
   const more=body.querySelector('[data-folder-more222]');
   if(more)more.onclick=()=>{
    runtime.limits.set(clientId,limit+12);
    body.replaceChildren();
    mount();
    body.querySelectorAll('.record-row220')[limit]?.querySelector('button')?.focus();
   };
  };
  let wasOpen=folder.open;
  if(wasOpen)mount();
  folder.ontoggle=()=>{
   if(!folder.isConnected||folder.open===wasOpen)return;
   wasOpen=folder.open;
   runtime.folders.set(clientId,wasOpen);
   if(wasOpen){mount();recordReveal222(body);}
  };
 });
 recordPage220(pager,runtime,folders.length,render,kind+'客戶');
 return folders.length;
}
function recordPage220(host,runtime,total,render,name) {
 const pages=Math.max(1,Math.ceil(total/runtime.size));
 if(pages===1){host.replaceChildren();return;}
 const page=runtime.page;
 host.innerHTML=`<nav class="record-pager220" aria-label="${esc(name)}分頁">
  <button class="btn" type="button" data-record-page220="prev" ${page===1?'disabled':''}>上一頁</button>
  <label>第 <select class="select" aria-label="${esc(name)}頁碼">${Array.from({length:pages},(_,index)=>
   `<option value="${index+1}" ${index+1===page?'selected':''}>${index+1}</option>`).join('')}</select> ／ ${pages} 頁</label>
  <button class="btn" type="button" data-record-page220="next" ${page===pages?'disabled':''}>下一頁</button></nav>`;
 const select=host.querySelector('select');
 const change=(value,selector)=>{
  runtime.page=value;
  render();
  const requested=host.querySelector(selector);
  (requested&&!requested.disabled?requested:host.querySelector('select'))?.focus();
 };
 select.onchange=()=>change(Number(select.value),'select');
 host.querySelectorAll('[data-record-page220]').forEach(button=>{
  const direction=button.dataset.recordPage220;
  button.onclick=()=>change(page+(direction==='next'?1:-1),`[data-record-page220="${direction}"]`);
 });
}
function recordClientOptions220(selected) {
 return state.clients.slice().sort((a,b)=>String(a.code||a.name||'').localeCompare(String(b.code||b.name||''),'zh-Hant',{numeric:true}))
  .map(client=>`<option value="${esc(client.id)}" ${client.id===selected?'selected':''}>${esc([client.code,client.name].filter(Boolean).join(' · '))}</option>`).join('');
}
