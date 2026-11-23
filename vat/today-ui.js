/* Customer jump is available from every view, including the narrow header. */
function openGlobalSearch(){
 const dialog=$('#customerJump226');
 if(dialog.open){$('#globalSearch').focus();return;}
 if($('#modalRoot.show')||document.querySelector('dialog[open]'))return;
 dialog.showModal();
 renderCustomerJump226();
 $('#globalSearch').focus();
 $('#globalSearch').select();
}
function renderCustomerJump226(){
 const query=$('#globalSearch').value.trim().toLocaleLowerCase();
 const matches=state.clients.filter(client=>!query||[client.name,client.code,client.address,
  ...(client.contacts||[]).flatMap(contact=>[contact.name,contact.contact])].join(' ').toLocaleLowerCase().includes(query));
 const visible=matches.slice(0,30),members=new Set(pcForPeriod().map(row=>row.clientId));
 $('#customerJumpCount226').textContent=`符合 ${matches.length} 位${matches.length>visible.length?' · 顯示前 '+visible.length+' 位':''}`;
 $('#customerJumpResults226').innerHTML=visible.map(client=>`<li>
  <button type="button" data-g-client="${esc(client.id)}">
   <span><strong>${esc(client.name)}</strong><small>${esc(client.code||'')}</small></span>
   <span>${members.has(client.id)?'本期工作':'客戶資料'} <span aria-hidden="true">›</span></span>
  </button>
 </li>`).join('');
}
function bindGlobalSearch226(){
 const dialog=$('#customerJump226'),input=$('#globalSearch'),results=$('#customerJumpResults226');
 $('#globalSearchLaunch').onclick=openGlobalSearch;
 $('#closeCustomerJump226').onclick=()=>dialog.close();
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 dialog.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!event.isComposing){event.preventDefault();dialog.close();}
 });
 input.oninput=event=>{if(!event.isComposing)renderCustomerJump226();};
 input.oncompositionend=renderCustomerJump226;
 input.onkeydown=event=>{
  if(event.isComposing)return;
  const first=results.querySelector('button');
  if(event.key==='ArrowDown'&&first){event.preventDefault();first.focus();}
  if(event.key==='Enter'&&first){event.preventDefault();first.click();}
 };
 results.onclick=event=>{
  const button=event.target.closest('[data-g-client]');
  if(!button)return;
  const client=clientById(button.dataset.gClient),pc=pcForPeriod().find(row=>row.clientId===client?.id);
  if(!client)return;
  if(pc&&state.view==='work'&&pc.id===state.selectedPCId){dialog.close();return;}
  if(!allowDiscard210())return;
  if(state.view==='work')state.workDraft=null;
  dialog.close();
  if(!pc){
   if(state.view==='work')renderWork();
   openClientModal(client);
   return;
  }
  state.selectedPCId=pc.id;
  state.workFilters=[];state.workQuick229='';
  $('#workSearch').value='';
  state.workTab='main';
  switchView('work');
 };
}
