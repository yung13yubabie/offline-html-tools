/* VAT_WORKBENCH_UI214_START — no external fonts, assets or runtime dependencies. */
function vatElement214(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!=null)el.textContent=String(text);return el;}
function vatReferenceMoney214(raw){return raw==null||String(raw).trim()===''||!Number.isFinite(Number(raw))?'尚未設定':money(Number(raw))+' 元';}
function vatClientFacts214(pc,master){
 const snapshot=pc.snapshot||{},liveContacts=Array.isArray(master?.contacts)&&master.contacts.length>0,contacts=liveContacts?{...snapshot,contacts:master.contacts}:snapshot;
 const reference=master?master.bookkeepingFee:snapshot.bookkeepingFee;
 return [
  {label:'本期地址',value:String(snapshot.address||'').trim()||'尚未設定',empty:!String(snapshot.address||'').trim()},
  {label:liveContacts?'聯絡人（客戶庫）':'聯絡人（本期資料）',value:String(contactSummary(contacts)||'').trim()||'尚未設定',empty:!String(contactSummary(contacts)||'').trim()},
  {label:'本期記帳費',value:vatReferenceMoney214(bookkeepingFeeOf(pc)),financial:true},
  {label:master?'客戶庫預設記帳費':'本期快照預設記帳費',value:vatReferenceMoney214(reference),financial:true,empty:reference==null||String(reference).trim()===''}
 ];
}
function renderClientOverview214(){
 const head=$('#workDetail .detail-head'),pc=state.periodClients.find(x=>x.id===state.selectedPCId&&x.periodId===state.periodId);if(!head||!pc)return;
 const title=head.querySelector('.detail-title'),copy=title?.parentElement;if(!title||!copy||copy.querySelector('.vat-client-identity214'))return;
 const c=pc.snapshot||{},master=clientById(pc.clientId)||null,identity=vatElement214('div','vat-client-identity214'),heading=vatElement214('div','vat-client-heading214');
 heading.append(vatElement214('h2','detail-title',c.name||'未命名客戶'));
 if(c.code)heading.append(vatElement214('span','vat-client-code214',c.code));
 if(pc.notApplicable)heading.append(vatElement214('span','vat-client-state214','本期不適用'));
 identity.append(heading);
 if(c.businessItem)identity.append(vatElement214('p','vat-client-business214',c.businessItem));
 const facts=vatElement214('dl','vat-client-facts214');facts.setAttribute('aria-label','客戶與本期資料');
 for(const item of vatClientFacts214(pc,master)){
  const row=vatElement214('div','vat-client-fact214'+(item.financial?' is-financial':'')+(item.empty?' is-empty':''));row.append(vatElement214('dt','',item.label),vatElement214('dd','',item.value));facts.append(row);
 }
 identity.append(facts);copy.insertBefore(identity,title);
 // Remove only the old title and its two immediate metadata lines. Keep live controls,
 // the portfolio strip and any feature content mounted elsewhere in this container.
 let next=title.nextElementSibling;for(let i=0;i<2&&next?.classList.contains('small');i++){const old=next;next=old.nextElementSibling;old.remove();}title.remove();
}
const renderWorkDetailBefore214Visual=renderWorkDetail;
renderWorkDetail=function(){const result=renderWorkDetailBefore214Visual();renderClientOverview214();return result;};
/* VAT_WORKBENCH_UI214_END */
