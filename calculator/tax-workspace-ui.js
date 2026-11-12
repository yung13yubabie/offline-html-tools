/* CALCULATOR_TAX_WORKSPACE_START */
(()=>{
 'use strict';
 const policy=createTaxWorkspacePolicy(),root=document.getElementById('taxPanel');if(!root)return;
 function tag(name,className,text){const el=document.createElement(name);if(className)el.className=className;if(text!=null)el.textContent=text;return el}
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
  const caption=tag('div','book-focus-caption',def.title);head.querySelector('.book-name-wrap').append(caption);
  const top=tag('div','book-focus-toolbar');top.append(add,warn);const upper=book.querySelector('.book-upper');if(upper)body.prepend(upper);body.prepend(options,top);
  const help=tag('details','book-help'),helpSummary=tag('summary','','操作說明'),helpBody=tag('div','book-help-body');help.append(helpSummary,helpBody);if(upper)helpBody.append(upper);body.querySelectorAll('.upper-guide').forEach(el=>helpBody.append(el));helpBody.append(tag('p','','逐筆輸入與合計輸入需在尚未填寫資料時切換；合計輸入請填張數。'),tag('p','','預設欄位與本類 Enter 方式可在設定調整，每冊也可另選 Enter 方式。退回／折讓一律輸入正數，系統自動作減項。'));body.append(help);
  const sticky=book.querySelector('.book-sticky');if(sticky)sticky.firstElementChild.firstChild.textContent=code+'｜';
  remove.setAttribute('aria-label','刪除冊別 '+code);remove.addEventListener('click',()=>cat.querySelector('.add-book')?.focus());
  return book;
 };
 const previousCategory=makeCategory;
 makeCategory=function(def,side){const cat=previousCategory(def,side),name=cat.querySelector('.category-name');name.lastElementChild.textContent=policy.number(def.id)+' '+def.title;cat.dataset.number=policy.number(def.id);
  if(policy.eligible.includes(def.id)){const field=tag('div','category-exempt'),label=tag('label','','免稅金額'),input=tag('input','tax-exempt-input'),err=tag('span','exempt-field-error');input.id='exempt-'+def.id;input.inputMode='decimal';input.placeholder='選填';input.maxLength=24;label.htmlFor=input.id;err.id=input.id+'-error';err.hidden=true;err.setAttribute('role','status');input.setAttribute('aria-describedby',err.id);field.append(label,input,err);cat.querySelector('.category-body').prepend(field);
   input.addEventListener('input',updateTaxTotals);input.addEventListener('blur',()=>{try{const value=policy.parse(input.value);if(!value.blank)input.value=policy.format(value.value)}catch{}updateTaxTotals()});}
  const button=cat.querySelector('.category-head');button.setAttribute('aria-expanded','false');button.addEventListener('click',()=>button.setAttribute('aria-expanded',String(cat.classList.contains('open'))));return cat;
 };
 const totalBox=tag('div','card summary-box exempt-total-box');totalBox.append(tag('div','k','免稅金額總計'));const total=tag('div','v money','0');total.id='exemptSalesTotal';total.setAttribute('aria-live','polite');totalBox.append(total);root.querySelector('.tax-summary').append(totalBox);
 const previousTotals=updateTaxTotals;
 updateTaxTotals=function(){previousTotals();const values=[];let invalid=false;root.querySelectorAll('.tax-exempt-input').forEach(input=>{const err=document.getElementById(input.getAttribute('aria-describedby'));try{const value=policy.parse(input.value);input.setAttribute('aria-invalid','false');err.hidden=true;err.textContent='';values.push(value.value)}catch(e){invalid=true;input.setAttribute('aria-invalid','true');err.textContent=e.message;err.hidden=false}});
  const exempt=root.querySelector('[data-cat="salesExempt"]');if(exempt)exempt.querySelectorAll('.tax-row [data-field="amount"]').forEach(input=>values.push(input.value));
  try{if(invalid)throw new Error('待修正');total.textContent=policy.format(policy.sum(values));total.dataset.state='ready'}catch{total.textContent='待修正';total.dataset.state='error'}
 };
 const previousBookSummary=updateBookSummary;
 updateBookSummary=function(book,def){previousBookSummary(book,def);const button=book.querySelector('.book-detail');if(button){const count=sumBook(book,def).warn;button.textContent='明細';button.setAttribute('aria-label',book.dataset.code+' 明細'+(count?'，'+count+' 筆警示':''));button.title=count?count+' 筆警示，開啟明細查看':'';button.classList.toggle('has-warning',!!count)}};
 const previousEnter=enterBookFocus,previousExit=exitBookFocus;
 enterBookFocus=function(book,def,input){book.closest('.category').classList.add('open');previousEnter(book,def,null);book.setAttribute('role','dialog');book.setAttribute('aria-modal','true');book.setAttribute('aria-label',def.title+' '+book.dataset.code+' 專心模式');book.closest('.category').querySelector('.category-head').setAttribute('aria-expanded','true');if(matchMedia('(max-width:1080px)').matches)showMobileSide(book.closest('.category').dataset.side);
  if(input&&document.activeElement!==input)requestAnimationFrame(()=>{const active=document.activeElement,editingInside=book.contains(active)&&active.getClientRects().length&&!active.matches('.book-detail,.book-toggle');if(book.classList.contains('focus-active')&&!editingInside)input.focus({preventScroll:true})});
 };
 exitBookFocus=function(book,restore=true){if(book){book.removeAttribute('role');book.removeAttribute('aria-modal');book.removeAttribute('aria-label')}const result=previousExit(book,false);if(book&&restore)requestAnimationFrame(()=>{const active=document.activeElement;if(!activeFocusBook()&&root.classList.contains('active')&&(book.contains(active)||active===document.body||active===document.getElementById('bookFocusBackdrop')))book.querySelector('.book-toggle')?.focus({preventScroll:true})});return result};
 // A hidden input must never re-open a book just because the viewport or side changes.
 showMobileSide=function(side){const active=activeFocusBook();if(active)side=active.closest('.category').dataset.side;document.getElementById('salesSide').classList.toggle('mobile-hidden',side!=='sales');document.getElementById('inputSide').classList.toggle('mobile-hidden',side!=='input');document.querySelectorAll('#sideTabs button').forEach(b=>b.classList.toggle('primary',b.dataset.side===side))};
 revealRow=function(row){const book=row.closest('.book'),cat=row.closest('.category'),def=catById(cat.dataset.cat),input=row.querySelector('.tax-input');enterBookFocus(book,def,input);requestAnimationFrame(()=>{if(book.classList.contains('focus-active'))row.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'})})};
 document.getElementById('bookFocusBackdrop').addEventListener('click',()=>exitBookFocus(activeFocusBook(),true));
 document.addEventListener('keydown',e=>{const book=activeFocusBook();if(!book||e.target.closest?.('#offline-review-host'))return;if(e.key==='Escape'){e.preventDefault();exitBookFocus(book,true)}else if(e.key==='Tab'){const nodes=[...book.querySelectorAll('button,input,select,textarea,summary,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}});
 renderTaxSides();updateAllSummaries();updateTaxTotals();syncResponsive();
})();
/* CALCULATOR_TAX_WORKSPACE_END */
