/* Shared row, expandable details and pagination layout for independent records. */
function recordFacts220(facts) {
 return `<dl class="record-facts220">${facts.map(([label,value])=>
  `<div><dt>${esc(label)}</dt><dd>${esc(value||'—')}</dd></div>`).join('')}</dl>`;
}
function recordList220(columns,rows,expanded) {
 return `<div class="record-list220">
  <div class="record-columns220" aria-hidden="true">${columns.map(label=>`<span>${esc(label)}</span>`).join('')}</div>
  <div role="list">${rows.map(row=>`<article role="listitem" class="record-item220" ${row.keyAttribute}="${esc(row.id)}">
   <div class="record-row220">${row.cells.map((content,index)=>
    `<div class="record-cell220"><span class="record-mobile-label220">${esc(columns[index])}</span>${content}</div>`).join('')}</div>
   <details class="record-details220" data-record-detail220="${esc(row.id)}" ${expanded.has(row.id)?'open':''}>
    <summary>${esc(row.detailLabel)}</summary>
    ${recordFacts220(row.facts)}
    ${row.detailActions||''}
   </details>
  </article>`).join('')}</div>
 </div>`;
}
function bindRecordDetails220(host,expanded) {
 host.querySelectorAll('[data-record-detail220]').forEach(details=>{
  details.ontoggle=()=>{if(details.isConnected){
   if(details.open)expanded.add(details.dataset.recordDetail220);
   else expanded.delete(details.dataset.recordDetail220);
  }};
 });
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
