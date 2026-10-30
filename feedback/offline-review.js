/* Offline Review 1.0.0 — dependency-free, inline this file before </body>. */
(() => {
  'use strict';
  if (document.getElementById('offline-review-host')) return;
  const config = window.OFFLINE_REVIEW_CONFIG || {};
  const appId = String(config.appId || 'offline-app').slice(0, 100);
  const appVersion = String(config.appVersion || 'unknown').slice(0, 100);
  const MAX_NOTES = 100, MAX_STORAGE_CHARS = 600000;
  const SCHEMA = 1, key = 'offline-review:1:' + encodeURIComponent(appId);
  const host = document.createElement('div'); host.id = 'offline-review-host';
  host.style.cssText = 'position:fixed;z-index:2147483647;right:12px;bottom:12px;pointer-events:none';
  const root = host.attachShadow({mode:'open'});
  const style = document.createElement('style');
  style.textContent = `:host{all:initial}*{box-sizing:border-box}button,select,textarea{font:inherit}button,select{min-height:42px}button{cursor:pointer;border:1px solid #9ca3af;border-radius:7px;padding:7px 12px;background:#fff;color:#152238}button:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #1676d2;outline-offset:2px}button.primary{background:#173e73;color:#fff}button:disabled{opacity:.5;cursor:default}[hidden]{display:none!important}.wrap{font:14px/1.5 system-ui,sans-serif;color:#152238;pointer-events:auto;max-width:calc(100vw - 24px)}.toggle{box-shadow:0 2px 10px #0003}.panel{margin-top:8px;background:#fff;border:2px solid #173e73;border-radius:12px;padding:12px;width:380px;max-width:100%;max-height:65vh;overflow:auto;box-shadow:0 4px 24px #0004}.row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}h2{font-size:18px;margin:0}p{margin:8px 0}label{display:block;margin-top:8px;font-weight:600}select,textarea{display:block;width:100%;border:1px solid #8090a4;border-radius:5px;background:white;color:#152238;padding:7px}textarea{min-height:85px;resize:vertical}.note{border-top:1px solid #d9e0ea;margin-top:10px;padding-top:8px;overflow-wrap:anywhere}.note p{white-space:pre-wrap}.muted{font-size:12px;color:#4b5563}.status{min-height:21px}.highlight{position:fixed;border:3px solid #e07800;background:#ffbc1714;pointer-events:none;z-index:-1;box-shadow:0 0 0 1px #fff}.selected{font-size:12px;overflow-wrap:anywhere}@media(max-width:600px){.panel{width:calc(100vw - 24px);max-height:48dvh}.toggle{min-height:44px}}`;
  root.append(style);
  const el = (tag, text, parent, attrs={}) => { const n=document.createElement(tag); if(text!==null)n.textContent=text; for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(parent)parent.append(n); return n; };
  const wrap=el('div',null,root,{class:'wrap'});
  const toggle=el('button','修改標註',wrap,{class:'toggle primary',type:'button','aria-expanded':'false'});
  const panel=el('section',null,wrap,{class:'panel','aria-label':'修改標註編輯模式'}); panel.hidden=true;
  el('h2','編輯模式 · 修改標註',panel);
  el('p','選擇區塊，寫下修正方向。這只記錄需求，不會自動修改程式或資料。',panel);
  el('p','不擷取頁面內容、不上傳。請勿輸入客戶資料或密碼。',panel,{class:'muted'});
  el('label','選擇區塊（也可點頁面）',panel,{for:'review-block'});
  const picker=el('select',null,panel,{id:'review-block'});
  const selectedText=el('p','尚未選擇區塊',panel,{class:'selected'});
  el('label','想要修正的方向',panel,{for:'review-note'});
  const input=el('textarea',null,panel,{id:'review-note',maxlength:'4000',placeholder:'例如：這個區塊的文字改大，手機上改成單欄。'});
  const actions=el('div',null,panel,{class:'row'});
  const save=el('button','儲存標註',actions,{type:'button',class:'primary'});
  const cancel=el('button','取消編輯',actions,{type:'button'}); cancel.hidden=true;
  const status=el('p','',panel,{class:'status muted',role:'status','aria-live':'polite'});
  const exports=el('div',null,panel,{class:'row'});
  const json=el('button','匯出 JSON',exports,{type:'button'}), txt=el('button','匯出 TXT',exports,{type:'button'});
  const close=el('button','離開編輯模式',exports,{type:'button'});
  const list=el('div',null,panel,{'aria-label':'已儲存標註'});
  const highlight=el('div',null,root,{class:'highlight','aria-hidden':'true'}); highlight.hidden=true;
  document.body.append(host);
  let active=false, selected=null, editing=null, blocks=[], notes=[], storageOK=true, previousFocus=null;
  function validNote(n){return n && typeof n.id==='string' && n.id.length<=128 && typeof n.text==='string' && n.text.length<=4000 && typeof n.createdAt==='string' && n.createdAt.length<=50 && typeof n.updatedAt==='string' && n.updatedAt.length<=50 && n.block && ['id','name','selector'].every(k=>typeof n.block[k]==='string' && n.block[k].length<=600);}
  try { const raw=localStorage.getItem(key); if(raw){if(raw.length>MAX_STORAGE_CHARS)throw Error('size');const data=JSON.parse(raw); if(data.schemaVersion!==SCHEMA||data.appId!==appId||!Array.isArray(data.annotations)||data.annotations.length>MAX_NOTES||!data.annotations.every(validNote))throw Error('format');notes=data.annotations.map(n=>({id:n.id,text:n.text,createdAt:n.createdAt,updatedAt:n.updatedAt,block:{id:n.block.id,name:n.block.name,selector:n.block.selector},appVersion:typeof n.appVersion==='string'?n.appVersion.slice(0,100):'unknown'}));} } catch(e){storageOK=false;}
  function payload(){return {schemaVersion:SCHEMA,toolVersion:'1.0.0',appId,appVersion,exportedAt:new Date().toISOString(),purpose:'修改需求（尚未實作）',annotations:notes};}
  function persist(){try{localStorage.setItem(key,JSON.stringify(payload()));storageOK=true;status.textContent='標註已儲存在此瀏覽器。';}catch(e){storageOK=false;status.textContent='無法保存到瀏覽器；目前暫存於記憶體，請立即匯出。';}}
  // Structural selectors intentionally omit IDs/classes/text from business DOM.
  function structural(node){const parts=[];while(node&&node!==document.documentElement){const tag=node.localName;const siblings=Array.from(node.parentElement?.children||[]).filter(n=>n.localName===tag);parts.unshift(tag+':nth-of-type('+(siblings.indexOf(node)+1)+')');node=node.parentElement;}return 'html > '+parts.join(' > ');}
  function refresh(){
    const scope=host.parentElement?.tagName==='DIALOG'?host.parentElement:null;
    const explicit=Array.from(document.querySelectorAll('[data-review-id]')).filter(n=>n!==host&&!host.contains(n)&&(!scope||scope.contains(n)));
    const candidates=explicit.length?explicit:Array.from(document.querySelectorAll('main,section,article,header,footer,nav,form,.card,.panel')).filter(n=>n!==host&&!host.contains(n));
    if(!candidates.length)candidates.push(...Array.from(document.body.children).filter(n=>n!==host&&!['SCRIPT','STYLE','LINK'].includes(n.tagName)));
    blocks=candidates.filter(n=>n.getClientRects().length).map((node,i)=>{const id=node.getAttribute('data-review-id');const unique=id&&explicit.filter(n=>n.getAttribute('data-review-id')===id).length===1;return {node,id:unique?id:'fallback:'+structural(node),name:node.getAttribute('data-review-name')||'區塊 '+(i+1),selector:unique?'[data-review-id='+JSON.stringify(id)+']':structural(node)};});
    picker.replaceChildren(); el('option','請選擇區塊',picker,{value:''});blocks.forEach((b,i)=>el('option',b.name,picker,{value:String(i)}));
  }
  function position(){if(!active||!selected?.node?.isConnected){highlight.hidden=true;return;}const r=selected.node.getBoundingClientRect();highlight.hidden=false;Object.assign(highlight.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}
  function choose(b,scroll=false){selected=b;picker.value=b?String(blocks.indexOf(b)):'';selectedText.textContent=b?b.name+' · '+b.id:'尚未選擇區塊';if(scroll&&b)b.node.scrollIntoView({block:'center',behavior:'auto'});position();}
  function reset(){editing=null;input.value='';save.textContent='儲存標註';cancel.hidden=true;}
  function render(){list.replaceChildren();el('p','已記錄 '+notes.length+' 則修改需求',list);notes.forEach(n=>{const item=el('div',null,list,{class:'note'});el('strong',n.block.name,item);el('p',n.block.id,item,{class:'muted'});el('p',n.text,item);const row=el('div',null,item,{class:'row'});const edit=el('button','編輯',row,{type:'button','aria-label':'編輯 '+n.block.name});edit.onclick=()=>{refresh();choose(blocks.find(b=>b.id===n.block.id)||null);editing=n.id;input.value=n.text;save.textContent='更新標註';cancel.hidden=false;status.textContent=selected?'編輯既有需求。':'原區塊已不在頁面；仍可更新原標註，或重新選擇區塊。';input.focus();};const del=el('button','刪除',row,{type:'button','aria-label':'刪除 '+n.block.name});del.onclick=()=>{if(!window.confirm('刪除此修改標註？'))return;notes=notes.filter(x=>x.id!==n.id);if(editing===n.id)reset();persist();render();};});}
  function mode(on){if(!on&&input.value.trim()&&!window.confirm('尚有未儲存的修改方向，確定離開並捨棄草稿？'))return;active=on;panel.hidden=!on;toggle.textContent=on?'結束標註':'修改標註';toggle.setAttribute('aria-expanded',String(on));if(on){previousFocus=document.activeElement;refresh();choose(null);reset();render();status.textContent=storageOK?'標註只保存在本機瀏覽器；請匯出備份。':'無法讀取標註儲存空間；請匯出備份，避免遺失。';picker.focus();}else{highlight.hidden=true;reset();if(previousFocus&&previousFocus!==document.body&&previousFocus.isConnected)previousFocus.focus();else toggle.focus();}}
  toggle.onclick=()=>mode(!active);close.onclick=()=>mode(false);cancel.onclick=reset;
  picker.onchange=()=>choose(blocks[Number(picker.value)]&&picker.value!==''?blocks[Number(picker.value)]:null,true);
  save.onclick=()=>{const text=input.value.trim();const old=notes.find(n=>n.id===editing);if(!selected&&!old){status.textContent='請先選擇區塊。';return;}if(!old&&notes.length>=MAX_NOTES){status.textContent='最多 100 則標註；請匯出並刪除不需要的標註。';return;}if(!text){status.textContent='請輸入修正方向。';input.focus();return;}const now=new Date().toISOString();const block=selected?{id:selected.id,name:selected.name,selector:selected.selector}:old.block;const note={id:old?.id||('note-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)),block,text,createdAt:old?.createdAt||now,updatedAt:now,appVersion};if(old)notes[notes.indexOf(old)]=note;else notes.push(note);persist();reset();render();};
  function download(format){const p=payload();const content=format==='json'?JSON.stringify(p,null,2):['修改需求（尚未實作）','應用：'+appId,'版本：'+appVersion,'結構版本：'+SCHEMA,'匯出時間：'+p.exportedAt,'',...notes.flatMap((n,i)=>[(i+1)+'. '+n.block.name,'區塊 ID：'+n.block.id,'定位：'+n.block.selector,'記錄版本：'+n.appVersion,'需求：'+n.text,''])].join('\n');const blob=new Blob([format==='txt'?'\uFEFF':'',content],{type:format==='json'?'application/json;charset=utf-8':'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=el('a',null,root,{href:url,download:appId.replace(/[^a-zA-Z0-9_-]/g,'_')+'-changes.'+format});a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='已產生下載檔；請確認瀏覽器下載結果。';}
  json.onclick=()=>download('json');txt.onclick=()=>download('txt');
  // Keep panel typing/clicks from reaching app bubble/delegated shortcut handlers.
  ['keydown','keyup','keypress','input','beforeinput','change','click','dblclick','pointerdown','pointerup','mousedown','mouseup','touchstart','touchend'].forEach(type=>root.addEventListener(type,e=>e.stopPropagation()));
  const inside=e=>e.composedPath().includes(host);
  function guard(e){if(!active||inside(e))return;if(e.type==='keydown'&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();mode(false);return;}if(e.type==='keydown'&&['PageDown','PageUp','ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.stopImmediatePropagation();return;}if(['touchstart','touchmove','touchend'].includes(e.type)){e.stopImmediatePropagation();return;}e.preventDefault();e.stopImmediatePropagation();if(e.type==='click'){const path=e.composedPath();const block=path.map(node=>blocks.find(b=>b.node===node)).find(Boolean);if(block){choose(block);status.textContent='已選擇：'+block.name;input.focus();}else status.textContent='請使用選單選擇可標註區塊。';}}
  ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchmove','touchend','click','dblclick','contextmenu','submit','cancel','keydown','keyup','beforeinput','input','change','dragstart','drop'].forEach(type=>window.addEventListener(type,guard,true));
  window.addEventListener('keydown',e=>{if(active&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();mode(false);}},true);
  window.addEventListener('focusin',e=>{if(active&&!inside(e))picker.focus();},true);
  window.addEventListener('scroll',position,true);window.addEventListener('resize',position);
  // Native showModal makes body siblings inert: move only our own host into the top modal.
  // No dialog open/close methods or business DOM are changed.
  if(typeof MutationObserver!=='undefined'){
    let currentModal=null;
    const relocate=records=>{
      const dialogs=Array.from(document.querySelectorAll('dialog[open]')).filter(n=>{try{return n.matches(':modal');}catch(e){return true;}});
      const recentlyOpened=Array.from(records||[]).reverse().map(r=>r.target).find(n=>dialogs.includes(n));
      const modal=recentlyOpened||(dialogs.includes(currentModal)?currentModal:dialogs[dialogs.length-1])||null;
      const parent=modal||document.body;
      if(host.parentElement!==parent){parent.append(host);currentModal=modal;if(active){const oldId=selected?.id;refresh();choose(blocks.find(b=>b.id===oldId)||null);picker.focus();}}
    };
    new MutationObserver(relocate).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
    relocate([]);
  }
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(position).observe(document.body);
})();
