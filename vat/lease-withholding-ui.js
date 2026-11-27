const leaseWithholding238=createLeaseWithholding238();
const leaseLessorOptions238=(kind='company')=>[['company','公司'],['individual','個人房東']]
 .map(([value,label])=>leaseOption224(value,label,kind)).join('');
const leaseResidencies238=[['resident','境內居住者 · 10%'],['nonresident','非居住者 · 20%']];
const leaseNhiRules238=[['standard','一般門檻'],['exempt','符合免扣取規定'],['special','適用其他法定門檻']];

function individualLeaseReview238(){
 const field=leaseField228;
 return `<section id="leaseIndividualReview238" class="lease-section224" hidden aria-labelledby="leasePayTitle238">
  <header><h3 id="leasePayTitle238">租賃所得扣繳與二代健保</h3><button class="btn primary" type="button" id="leasePayNew238">＋ 新增給付</button></header>
  <div class="lease-pay-toolbar238">
   <label class="field">給付年度<select class="select" id="leasePayYear238"></select></label>
   <details class="lease-pay-rules238"><summary>試算規則</summary>
    <p>同一出租方一次給付多月或多個據點，請用一筆填該次給付總額。約定代房東負擔稅費時，總額應包含應併入的代付款。</p>
    <p>境內居住者 10%，每次應扣稅額不超過 2,000 元免扣繳。非居住者 20%。二代健保一般門檻 20,000 元，達門檻按全額計 2.11%，計費上限 1,000 萬元。</p>
    <p>供扣繳義務人核對 2021 年起的給付。免扣取或特殊門檻依適用資格與證明填寫。</p>
    <a href="https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0340028" target="_blank" rel="noopener">扣繳率標準</a>
    <a href="https://www.nhi.gov.tw/ch/cp-3283-34642-2589-1.html" target="_blank" rel="noopener">健保署計算公式</a>
   </details>
  </div>
  <form id="leasePayEditor238" class="lease-pay-editor238" hidden novalidate>
   <div class="lease-pay-editor-head238"><h4 id="leasePayEditorTitle238"></h4>
    <label class="field" id="leasePayImportField238">帶入契約月租<select class="select" id="leasePayImport238"></select></label></div>
   <div class="lease-pay-fields238">
    ${field('leasePayDate238','實際給付日','date','min="'+leaseWithholding238.minDate+'" required')}
    ${field('leasePayAmount238','單次給付總額（元）','text','inputmode="decimal" required')}
    <label class="field">所得人身分<select class="select" id="leasePayResidence238">${leaseResidencies238.map(([value,label])=>leaseOption224(value,label,'resident')).join('')}</select></label>
    <label class="field">二代健保門檻<select class="select" id="leasePayNhiRule238">${leaseNhiRules238.map(([value,label])=>leaseOption224(value,label,'standard')).join('')}</select></label>
    ${field('leasePayNhiMin238','適用門檻（元）','text','inputmode="decimal"')}
    ${field('leasePayNote238','給付備註','text','maxlength="240" placeholder="例如 1–3 月租金"')}
   </div>
   <div class="lease-pay-metrics238">
    <section class="lease-metric224">
     <header><h4>租賃所得扣繳</h4><output id="leasePayTaxDue238" role="status">—</output></header>
     ${field('leasePayTaxActual238','實扣所得稅（元）','text','inputmode="decimal" placeholder="待核對"')}
    </section>
    <section class="lease-metric224">
     <header><h4>二代健保補充保費</h4><output id="leasePayNhiDue238" role="status">—</output></header>
     ${field('leasePayNhiActual238','實扣補充保費（元）','text','inputmode="decimal" placeholder="待核對"')}
    </section>
   </div>
   <p class="notice warn" id="leasePayError238" role="alert" tabindex="-1" hidden></p>
   <footer><button class="btn ghost" type="button" id="leasePayCancel238">取消編輯</button>
    <button class="btn primary" type="submit" id="leasePayApply238">套用給付</button></footer>
  </form>
  <div id="leasePaySummary238" class="lease-pay-summary238" aria-live="polite"></div>
  <div id="leasePayList238"></div>
 </section>`;
}

function mountIndividualLease238(baseline){
 let rows=clone(baseline.leasePayments||[]),editingId='',editorInitial='',references=[];
 const editor=$('#leasePayEditor238'),year=$('#leasePayYear238'),list=$('#leasePayList238');
 const get=key=>$('#leasePay'+key+'238');
 const fields={date:get('Date'),amount:get('Amount'),residency:get('Residence'),nhiRule:get('NhiRule'),
  nhiMin:get('NhiMin'),taxActual:get('TaxActual'),nhiActual:get('NhiActual'),note:get('Note')};
 const format=leaseEngine224.format;
 const snapshot=()=>JSON.stringify(Object.values(fields).map(input=>input.value));
 const dirtyEditor=()=>!editor.hidden&&snapshot()!==editorInitial;
 const amount=key=>leaseEngine224.amount(fields[key].value);
 function amounts(){
  return {amount:amount('amount'),residency:fields.residency.value,nhiRule:fields.nhiRule.value,
   nhiMin:fields.nhiRule.value==='special'?amount('nhiMin'):null};
 }
 function updatePreview(){
  fields.nhiMin.closest('label').hidden=fields.nhiRule.value!=='special';
  let expected;
  try{
   const draft=amounts();
   if(draft.amount>0&&(draft.nhiRule!=='special'||leaseWithholding238.specialMin(draft.nhiMin))){
    expected=leaseWithholding238.calculate(draft);
   }
  }catch{}
  get('TaxDue').textContent=expected?'應扣 '+leaseMoney224(expected.tax):'—';
  get('NhiDue').textContent=expected?'應扣 '+leaseMoney224(expected.nhi):'—';
 }
 function edit(row){
  if(dirtyEditor()&&!window.confirm('此筆給付尚未套用，捨棄編輯？'))return;
  editingId=row?.id||uid('leasepay');
  get('EditorTitle').textContent=row?'編輯給付':'新增給付';
  for(const key of ['amount','nhiMin','taxActual','nhiActual'])fields[key].value=format(row?.[key]);
  fields.date.value=row?.date||'';
  fields.residency.value=row?.residency||'resident';
  fields.nhiRule.value=row?.nhiRule||'standard';
  fields.note.value=row?.note||'';
  get('Import').value='';
  get('Error').hidden=true;
  editor.hidden=false;
  editorInitial=snapshot();
  updatePreview();
  fields.date.focus();
 }
 function closeEditor(){
  editingId='';
  editor.hidden=true;
 }
 function collect(submit=false){
  if(editor.hidden)return rows;
  if(!dirtyEditor()&&!submit){closeEditor();return rows;}
  const row={id:editingId,date:fields.date.value,...amounts(),taxActual:amount('taxActual'),
   nhiActual:amount('nhiActual'),note:fields.note.value};
  const next=rows.filter(item=>item.id!==editingId);
  rows=leaseWithholding238.normalize([...next,row]);
  if(year.value&&year.value!==row.date.slice(0,4))year.value='';
  closeEditor();
  render();
  return rows;
 }
 function comparison(expected,actual){
  if(actual===null)return `<strong>${esc(leaseMoney224(expected))}</strong><small>${expected?'待核對':'免扣'}</small>`;
  const badge=actual===expected?statusBadge('相符','green'):statusBadge('差 '+leaseMoney224(actual-expected),'orange');
  return `<strong>${esc(leaseMoney224(expected))}</strong><small>實扣 ${esc(leaseMoney224(actual))} ${badge}</small>`;
 }
 function render(){
  const selection=year.value,years=[...new Set(rows.map(row=>row.date.slice(0,4)))].sort().reverse();
  year.innerHTML='<option value="">全部年度</option>'+years.map(key=>leaseOption224(key,leaseYear224(key),selection)).join('');
  const visible=rows.filter(row=>!year.value||row.date.startsWith(year.value+'-'))
   .sort((a,b)=>b.date.localeCompare(a.date));
  const calculations=visible.map(row=>({row,...leaseWithholding238.calculate(row)}));
  const total=key=>calculations.reduce((sum,row)=>sum+row[key],0);
  get('Summary').innerHTML=`<span>${visible.length} 筆給付</span><span>應扣所得稅 <strong>${esc(leaseMoney224(total('tax')))}</strong></span>
   <span>應扣補充保費 <strong>${esc(leaseMoney224(total('nhi')))}</strong></span>`;
  list.innerHTML=calculations.length?`<div class="lease-pay-table238">
   <div class="lease-pay-row238 lease-pay-head238" aria-hidden="true"><span>給付日</span><span>給付總額</span><span>應扣所得稅</span><span>應扣補充保費</span><span></span></div>
   ${calculations.map(({row,tax,nhi})=>`<div class="lease-pay-row238" data-lease-pay-row238="${esc(row.id)}">
    <div><time datetime="${esc(row.date)}">${esc(fmtDate(row.date))}</time>${row.note?`<small>${esc(row.note)}</small>`:''}</div>
    <strong>${esc(leaseMoney224(row.amount))}</strong>
    <div class="lease-pay-tax238">${comparison(tax,row.taxActual)}</div>
    <div class="lease-pay-nhi238">${comparison(nhi,row.nhiActual)}</div>
    <div class="lease-pay-actions238"><button class="btn small" type="button" data-pay-edit238>編輯</button>
      <button class="btn small ghost danger" type="button" data-pay-delete238>刪除</button></div>
   </div>`).join('')}</div>`:'<div class="empty">尚無給付紀錄</div>';
 }
 get('New').onclick=()=>edit();
 get('Cancel').onclick=()=>{
  if(dirtyEditor()&&!window.confirm('此筆給付尚未套用，捨棄編輯？'))return;
  closeEditor();
  get('New').focus();
 };
 editor.oninput=updatePreview;
 editor.onsubmit=event=>{
  event.preventDefault();
  try{collect(true);get('New').focus();}
  catch(error){get('Error').textContent=error.message;get('Error').hidden=false;get('Error').focus();}
 };
 get('Import').onchange=event=>{
  const row=references.find(item=>item.key===event.target.value);
  if(row){fields.amount.value=format(row.base);updatePreview();}
 };
 year.onchange=render;
 list.onclick=event=>{
  const id=event.target.closest('[data-lease-pay-row238]')?.dataset.leasePayRow238;
  if(!id)return;
  if(event.target.closest('[data-pay-edit238]'))edit(rows.find(row=>row.id===id));
  if(event.target.closest('[data-pay-delete238]')&&window.confirm('移除這筆給付與實扣紀錄？儲存合約後生效。')){
   rows=rows.filter(row=>row.id!==id);
   if(editingId===id)closeEditor();
   render();
   get('New').focus();
  }
 };
 return {
  show(periods){
   references=periods.flatMap(period=>period.rentRows).filter(row=>row.base!==null&&row.base>0);
   const value=get('Import').value;
   get('ImportField').hidden=!references.length;
   get('Import').innerHTML='<option value="">選擇租金月份</option>'+references.map(row=>
    leaseOption224(row.key,rentMonthLabel234(row)+' · '+leaseMoney224(row.base),value)).join('');
   render();
  },
  snapshot:()=>JSON.stringify([rows,!editor.hidden&&dirtyEditor()?snapshot():'']),
  collect
 };
}
