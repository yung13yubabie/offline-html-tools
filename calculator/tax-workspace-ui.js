/* CALCULATOR_TAX_WORKSPACE_START */
(()=>{
 'use strict';
 const policy=createTaxWorkspacePolicy(),root=document.getElementById('taxPanel');if(!root)return;
 function tag(name,className,text){const el=document.createElement(name);if(className)el.className=className;if(text!=null)el.textContent=text;return el}
 const reviewStates=new WeakMap();
 function rowInputs(row){return Object.fromEntries([...row.querySelectorAll('.tax-input')].map(i=>[i.dataset.field,i]))}
 function isExempt(row,def){return policy.eligible.includes(def.id)&&row.dataset.exempt==='1'}
 function clearExempt(row){delete row.dataset.exempt;delete row.dataset.exemptValue;delete row.dataset.exemptInvalid;const tax=row.querySelector('[data-field="tax"]');if(tax)tax.placeholder='0';const note=row.querySelector('.tax-exempt-note');if(note)note.hidden=true;}
 function syncExempt(row,def,field,activation=false){
  const inputs=rowInputs(row),source=field==='gross'?'gross':'net',raw=inputs[source]?.value||'';
  if(!raw.trim()){clearExempt(row);for(const key of ['net','gross','tax'])if(inputs[key])inputs[key].value='';for(const key of ['committed','initialized','dirtyField','pendingSource','sourceField','lastAmountField','exemptBasis'])delete row.dataset[key];row.classList.remove('confirming');return;}
  row.dataset.exempt='1';row.dataset.exemptBasis=source;row.dataset.committed='1';inputs.tax.value='';inputs.tax.placeholder='免稅';row.classList.remove('confirming');delete row.dataset.pendingSource;
  const note=row.querySelector('.tax-exempt-note');if(note)note.hidden=false;
  try{const value=policy.exemptAmounts(def.id,raw);row.dataset.exemptValue=String(value.amount);delete row.dataset.exemptInvalid;setField(row,source==='net'?'gross':'net',value.amount);if(activation)setField(row,source,value.amount);}
  catch{delete row.dataset.exemptValue;row.dataset.exemptInvalid='1';}
 }
 const previousAddRow=addTaxRow;
 addTaxRow=function(book,def){const row=previousAddRow(book,def);if(!policy.eligible.includes(def.id))return row;
  const note=tag('div','tax-exempt-note','免稅：稅額已清空，未稅＝含稅');note.hidden=true;note.setAttribute('role','status');row.append(note);
  row.addEventListener('input',event=>{const input=event.target;if(!input.matches('.tax-input'))return;const field=input.dataset.field,inputs=rowInputs(row);
   if(field==='net'||field==='gross')row.dataset.lastAmountField=field;
   if(field==='tax'){
    if(input.value.trim()===''&&(inputs.net.value.trim()!==''||inputs.gross.value.trim()!=='')){const basis=row.dataset.lastAmountField||(['net','gross'].includes(row.dataset.sourceField)?row.dataset.sourceField:categoryDefault[def.id]);const source=inputs[basis]?.value.trim()?basis:inputs.net.value.trim()?'net':'gross';syncExempt(row,def,source,true);}
    else if(input.value.trim()!=='')clearExempt(row);
   }else if(isExempt(row,def)&&(field==='net'||field==='gross'))syncExempt(row,def,field);
  },true);
  for(const input of row.querySelectorAll('.tax-input')){let beforeBlur='';input.addEventListener('blur',()=>{beforeBlur=input.value},true);input.addEventListener('blur',()=>{if(!isExempt(row,def)||!['net','gross'].includes(input.dataset.field))return;try{policy.parse(beforeBlur)}catch{input.value=beforeBlur}syncExempt(row,def,input.dataset.field);evaluateRow(row,def,book)});}
  return row;
 };
 const previousWarning=warningInfo;
 warningInfo=function(row,def,book){if(isExempt(row,def))return row.dataset.exemptInvalid==='1'?{level:'danger',text:'免稅金額請填 0 以上數字，最多兩位小數；發票金額以整元顯示。'}:{level:'',text:''};return previousWarning(row,def,book)};
 const previousConfirm=showInlineConfirm;
 showInlineConfirm=function(row,def,source){if(isExempt(row,def)){row.classList.remove('confirming');delete row.dataset.pendingSource;return}return previousConfirm(row,def,source)};
 function bookExemption(book){const rows=[...book.querySelectorAll('.tax-row[data-exempt="1"]')];if(rows.some(r=>r.dataset.exemptInvalid==='1'))return {has:true,invalid:true,value:0};try{return {has:rows.length>0,invalid:false,value:policy.sum(rows.map(r=>r.dataset.exemptValue||'0'))}}catch{return {has:rows.length>0,invalid:true,value:0}};}
 function setReview(book,on){
  const def=catById(book.closest('.category').dataset.cat),panel=book.querySelector('.book-review'),button=book.querySelector('.book-review-toggle');if(!panel||!button)return;
  if(on){const invalid=book.querySelector('.tax-row[data-exempt-invalid="1"]');if(invalid){toast('請先修正第 '+invalid.querySelector('.row-index').textContent+' 筆免稅金額');revealRow(invalid);return false;}renderReview(book,def);book.dataset.review='1';panel.hidden=false;button.textContent='返回登打';button.setAttribute('aria-pressed','true');const state=reviewStates.get(book);requestAnimationFrame(()=>{if(book.dataset.review==='1')panel.scrollTop=state?.scrollTop||0});}
  else{if(book.dataset.review==='1'){const state=reviewStates.get(book)||{};state.scrollTop=panel.scrollTop;reviewStates.set(book,state);}delete book.dataset.review;panel.hidden=true;button.textContent='覆核';button.setAttribute('aria-pressed','false');}
  return true;
 }
 function renderReview(book,def){
  const panel=book.querySelector('.book-review'),table=tag('table','book-review-table'),head=tag('thead'),header=tag('tr');table.setAttribute('aria-label',book.dataset.code+' 覆核');
  for(const label of ['序列','未稅','稅額','含稅']){const th=tag('th','',label);th.scope='col';header.append(th)}head.append(header);table.append(head);const body=tag('tbody');
  for(const row of book.querySelectorAll('.tax-row')){if(![...row.querySelectorAll('.tax-input')].some(i=>i.value.trim()!==''))continue;const tr=tag('tr'),seq=tag('td'),n=row.querySelector('.row-index').textContent,link=tag('button','review-sequence',n);link.type='button';link.setAttribute('aria-label','編輯第 '+n+' 筆');
   link.addEventListener('click',()=>{if(!row.isConnected||!book.contains(row)){renderReview(book,def);return}setReview(book,false);const target=row.querySelector('[data-field="'+(def.kind==='simple'?'amount':categoryDefault[def.id])+'"]')||row.querySelector('.tax-input');enterBookFocus(book,def,target);requestAnimationFrame(()=>{if(book.classList.contains('focus-active'))row.scrollIntoView({block:'center',behavior:'auto'})});});seq.append(link);tr.append(seq);
   const values=rowValues(row),numbers=def.kind==='simple'?[values.amount,0,values.amount]:[values.net,values.tax,values.gross];for(const value of numbers)tr.append(tag('td','review-amount',fmt(value)));body.append(tr);
  }
  table.append(body);panel.replaceChildren(table);
 }
 const previousSummary=summaryHtml;
 summaryHtml=function(s,def){return def.kind==='simple'?[['未稅',s.amount],['稅額',0],['含稅',s.amount]].map(([label,value])=>`<div class="sum-cell"><span class="sum-label">${label}</span><span class="sum-value money">${fmt(value)}</span></div>`).join(''):previousSummary(s,def)};
 const previousInput=inputHtml;
 inputHtml=function(field,def){const labels={count:'張數',net:'未稅',tax:'稅額',gross:'含稅',amount:def.id==='salesExempt'?'免稅金額':def.id==='salesZero'?'零稅率金額':'金額'};const wrap=tag('label','tax-field-cell');wrap.append(tag('span','tax-cell-label',labels[field]||field));const fragment=document.createElement('template');fragment.innerHTML=previousInput(field,def);const input=fragment.content.querySelector('input');input.setAttribute('aria-label',labels[field]||field);wrap.append(input);return wrap.outerHTML};
 function openDetails(book,def){book.closest('.category').classList.add('open');const input=book.querySelector(`[data-field="${categoryDefault[def.id]||'amount'}"]`)||book.querySelector('.tax-input');enterBookFocus(book,def,input)}
 const previousBook=addBook;
 addBook=function(cat,def){const book=previousBook(cat,def),code=policy.code(def.id,Number(book.dataset.book)),head=book.querySelector('.book-head'),body=book.querySelector('.book-body'),controls=book.querySelector('.book-controls');
  book.dataset.code=code;const oldToggle=book.querySelector('.book-toggle'),toggle=tag('button','book-toggle',code);toggle.type='button';toggle.setAttribute('aria-label',def.title+' '+code+' 明細');toggle.addEventListener('click',()=>openDetails(book,def));oldToggle.replaceWith(toggle);
  const options=tag('div','book-focus-options');for(const [selector,label]of [['.usage-select','用途'],['.mode-select','輸入方式'],['.enter-select','按 Enter 後']]){const select=controls.querySelector(selector);if(!select)continue;const field=tag('label','book-option');field.append(tag('span','',label),select);options.append(field)}
  const add=controls.querySelector('.add-detail'),done=controls.querySelector('.focus-done'),remove=controls.querySelector('.delete-book'),warn=controls.querySelector('.book-warn'),detail=tag('button','btn small book-detail','明細'),actions=tag('div','book-actions');detail.type='button';detail.setAttribute('aria-label',code+' 明細');detail.addEventListener('click',()=>openDetails(book,def));actions.append(detail,remove,done);head.append(actions);controls.remove();
  const review=tag('div','book-review');review.hidden=true;book.append(review);const reviewButton=tag('button','btn small book-review-toggle','覆核');reviewButton.type='button';reviewButton.setAttribute('aria-pressed','false');reviewButton.addEventListener('click',()=>setReview(book,book.dataset.review!=='1'));actions.insertBefore(reviewButton,done);if(policy.eligible.includes(def.id)){const exemption=tag('div','book-exempt-summary');exemption.hidden=true;exemption.append(tag('span','','免稅合計'),tag('strong','','0'));head.children[1].append(exemption);}
  const caption=tag('div','book-focus-caption',def.title);head.querySelector('.book-name-wrap').append(caption);
  const top=tag('div','book-focus-toolbar');top.append(add,warn);const upper=book.querySelector('.book-upper');if(upper)body.prepend(upper);body.prepend(options,top);
  const help=tag('details','book-help'),helpSummary=tag('summary','','操作說明'),helpBody=tag('div','book-help-body');help.append(helpSummary,helpBody);if(upper)helpBody.append(upper);body.querySelectorAll('.upper-guide').forEach(el=>helpBody.append(el));helpBody.append(tag('p','','逐筆輸入與合計輸入需在尚未填寫資料時切換；合計輸入請填張數。'),tag('p','','預設欄位與本類 Enter 方式可在設定調整，每冊也可另選 Enter 方式。退回／折讓一律輸入正數，系統自動作減項。'));body.append(help);
  const sticky=book.querySelector('.book-sticky');if(sticky)sticky.firstElementChild.firstChild.textContent=code+'｜';
  remove.setAttribute('aria-label','刪除冊別 '+code);remove.addEventListener('click',()=>cat.querySelector('.add-book')?.focus());
  return book;
 };
 const previousCategory=makeCategory;
 makeCategory=function(def,side){const cat=previousCategory(def,side),name=cat.querySelector('.category-name');name.lastElementChild.textContent=policy.number(def.id)+' '+def.title;cat.dataset.number=policy.number(def.id);
  const button=cat.querySelector('.category-head');button.setAttribute('aria-expanded','false');button.addEventListener('click',()=>button.setAttribute('aria-expanded',String(cat.classList.contains('open'))));return cat;
 };
 const totalBox=tag('div','card summary-box exempt-total-box');totalBox.append(tag('div','k','免稅金額總計'));const total=tag('div','v money','0');total.id='exemptSalesTotal';total.setAttribute('aria-live','polite');totalBox.append(total);root.querySelector('.tax-summary').append(totalBox);
 const previousTotals=updateTaxTotals;
 updateTaxTotals=function(){previousTotals();const values=[];let invalid=false;root.querySelectorAll('.category').forEach(cat=>{if(!policy.eligible.includes(cat.dataset.cat))return;cat.querySelectorAll('.tax-row[data-exempt="1"]').forEach(row=>{if(row.dataset.exemptInvalid==='1')invalid=true;else values.push(row.dataset.exemptValue||'0')})});
  const exempt=root.querySelector('[data-cat="salesExempt"]');if(exempt)exempt.querySelectorAll('.tax-row [data-field="amount"]').forEach(input=>values.push(input.value));
  try{if(invalid)throw new Error('待修正');total.textContent=policy.format(policy.sum(values));total.dataset.state='ready'}catch{total.textContent='待修正';total.dataset.state='error'}
 };
 const previousBookSummary=updateBookSummary;
 updateBookSummary=function(book,def){previousBookSummary(book,def);const button=book.querySelector('.book-detail');if(button){const exemption=book.querySelector('.book-exempt-summary');if(exemption){const amount=bookExemption(book);exemption.hidden=!amount.has;exemption.querySelector('strong').textContent=amount.invalid?'待修正':policy.format(amount.value);}const count=sumBook(book,def).warn;button.textContent='明細';button.setAttribute('aria-label',book.dataset.code+' 明細'+(count?'，'+count+' 筆警示':''));button.title=count?count+' 筆警示，開啟明細查看':'';button.classList.toggle('has-warning',!!count)}};
 const previousEnter=enterBookFocus,previousExit=exitBookFocus;
 enterBookFocus=function(book,def,input){if(input&&book.dataset.review==='1')setReview(book,false);book.closest('.category').classList.add('open');previousEnter(book,def,null);book.setAttribute('role','dialog');book.setAttribute('aria-modal','true');book.setAttribute('aria-label',def.title+' '+book.dataset.code+' 專心模式');book.closest('.category').querySelector('.category-head').setAttribute('aria-expanded','true');if(matchMedia('(max-width:1080px)').matches)showMobileSide(book.closest('.category').dataset.side);
  if(input&&document.activeElement!==input)requestAnimationFrame(()=>{const active=document.activeElement,editingInside=book.contains(active)&&active.getClientRects().length&&!active.matches('.book-detail,.book-toggle');if(book.classList.contains('focus-active')&&book.dataset.review!=='1'&&!editingInside)input.focus({preventScroll:true})});
 };
 exitBookFocus=function(book,restore=true){if(book)setReview(book,false);if(book){book.removeAttribute('role');book.removeAttribute('aria-modal');book.removeAttribute('aria-label')}const result=previousExit(book,false);if(book&&restore)requestAnimationFrame(()=>{const active=document.activeElement;if(!activeFocusBook()&&root.classList.contains('active')&&(book.contains(active)||active===document.body||active===document.getElementById('bookFocusBackdrop')))book.querySelector('.book-toggle')?.focus({preventScroll:true})});return result};
 // A hidden input must never re-open a book just because the viewport or side changes.
 showMobileSide=function(side){const active=activeFocusBook();if(active)side=active.closest('.category').dataset.side;document.getElementById('salesSide').classList.toggle('mobile-hidden',side!=='sales');document.getElementById('inputSide').classList.toggle('mobile-hidden',side!=='input');document.querySelectorAll('#sideTabs button').forEach(b=>b.classList.toggle('primary',b.dataset.side===side))};
 revealRow=function(row){const book=row.closest('.book'),cat=row.closest('.category'),def=catById(cat.dataset.cat),input=row.querySelector('.tax-input');enterBookFocus(book,def,input);requestAnimationFrame(()=>{if(book.classList.contains('focus-active'))row.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'})})};
 document.getElementById('bookFocusBackdrop').addEventListener('click',()=>exitBookFocus(activeFocusBook(),true));
 document.addEventListener('keydown',e=>{const book=activeFocusBook();if(!book||e.target.closest?.('#offline-review-host'))return;if(e.key==='Escape'){e.preventDefault();exitBookFocus(book,true)}else if(e.key==='Tab'){const nodes=[...book.querySelectorAll('button,input,select,textarea,summary,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}});
 renderTaxSides();updateAllSummaries();updateTaxTotals();syncResponsive();
})();
/* CALCULATOR_TAX_WORKSPACE_END */
