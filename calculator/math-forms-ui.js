/* CALCULATOR_MATH_UI_START */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), F = MathFormEngine, M = CalculatorMathTools;
  const draft = Array.from({length:20}, () => ({terms:Array.from({length:10}, () => ({sign:'+',value:''})),constant:''}));
  let ratioDirection = 'forward', customPercent = '100', basis = 'whole';
  const targets = {forward:'',reverse:''};
  function el(tag, className, text) {const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
  function clearResult(id) {
    const node=$(id+'Result');node.replaceChildren();delete node.dataset.status;
    $(id+'Empty').hidden=false;$(id+'Empty').textContent='條件已更新，請重新按計算按鈕。';
  }
  function showResult(id, status) {const n=$(id+'Result');n.replaceChildren();n.dataset.status=status;$(id+'Empty').hidden=true;return n;}
  function reveal(id) {
    if(matchMedia('(max-width:1100px)').matches)$(id+'Result').scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
  }
  function choices(node, count, label) {for(let i=1;i<=count;i++){const option=el('option','',label(i));option.value=String(i);node.append(option);}}
  choices($('linearVariableCount'),10,i=>i+' 元');
  choices($('linearEquationCount'),20,i=>i+' 條');
  $('linearVariableCount').value='2';$('linearEquationCount').value='2';
  function shape() {return {variables:Number($('linearVariableCount').value),equations:Number($('linearEquationCount').value)};}
  function build() {const {variables,equations}=shape();return F.buildLinear({variableCount:variables,rows:draft.slice(0,equations).map(row=>({terms:row.terms.slice(0,variables),constant:row.constant}))});}
  function previewLinear() {
    const {variables,equations}=shape(),isText=$('linearEntryMode').value==='text';
    $('linearShape').textContent=isText?'進階文字輸入':variables+' 個未知數 · '+equations+' 條條件';
    const lines=draft.slice(0,equations).map(row=>row.terms.slice(0,variables).map((term,index)=>(index?' '+(term.sign==='-'?'−':'+')+' ':term.sign==='-'?'−':'')+(term.value.trim()||'0')+' × '+F.names[index]).join('')+' = '+(row.constant.trim()||'□'));
    $('linearPreview').textContent=isText?($('linearInput').value.trim()||'在左側貼上完整方程式。'):lines.join('\n');
  }
  function renderRows() {
    const {variables,equations}=shape(),fragment=document.createDocumentFragment();
    for(let i=0;i<equations;i++){
      const row=el('div','equation-row');row.dataset.row=String(i);
      const heading=el('div','equation-row-heading');heading.append(el('span','','第 '+(i+1)+' 條條件'),el('span','','＝'));
      const terms=el('div','equation-terms');terms.style.setProperty('--term-columns',String(Math.min(variables,3)));
      for(let j=0;j<variables;j++){
        const group=el('div','coefficient-field');group.append(el('span','',F.names[j]+' 的係數'));
        const controls=el('div','coefficient-control'),sign=el('select','linear-sign'),input=el('input','linear-coefficient');
        for(const [value,label]of [['+','＋'],['-','−']]){const option=el('option','',label);option.value=value;sign.append(option);}
        sign.value=draft[i].terms[j].sign;sign.dataset.column=String(j);sign.setAttribute('aria-label','第 '+(i+1)+' 條 '+F.names[j]+' 的正負號');
        input.type='text';input.inputMode='decimal';input.maxLength=120;input.placeholder='0';input.value=draft[i].terms[j].value;input.dataset.column=String(j);input.setAttribute('aria-label','第 '+(i+1)+' 條 '+F.names[j]+' 的係數');
        controls.append(sign,input,el('span','coefficient-symbol',F.names[j]));group.append(controls);terms.append(group);
      }
      const constant=el('div','equation-constant'),label=el('label'),input=el('input','linear-constant');
      input.type='text';input.inputMode='decimal';input.maxLength=120;input.placeholder='必填';input.value=draft[i].constant;input.id='linearConstant'+i;label.htmlFor=input.id;
      label.append(el('span','equals-symbol','='),el('span','','右側數值'),input);constant.append(label);row.append(heading,terms,constant);fragment.append(row);
    }
    $('linearRows').replaceChildren(fragment);previewLinear();
  }
  function saveField(event) {
    const field=event.target,row=field.closest('.equation-row');if(!row)return;
    const index=Number(row.dataset.row),column=Number(field.dataset.column);
    if(field.classList.contains('linear-sign'))draft[index].terms[column].sign=field.value;
    else if(field.classList.contains('linear-coefficient'))draft[index].terms[column].value=field.value;
    else if(field.classList.contains('linear-constant'))draft[index].constant=field.value;
    else return;
    $('linearPreset').value='';clearResult('linear');previewLinear();
  }
  $('linearRows').addEventListener('input',saveField);$('linearRows').addEventListener('change',saveField);
  for(const id of ['linearVariableCount','linearEquationCount'])$(id).addEventListener('change',()=>{clearResult('linear');renderRows();$('linearPreset').value='';});
  $('linearEntryMode').addEventListener('change',()=>{const text=$('linearEntryMode').value==='text';$('linearBuilder').hidden=text;$('linearTextEditor').hidden=!text;clearResult('linear');previewLinear();});
  $('linearInput').addEventListener('input',()=>{clearResult('linear');previewLinear();});
  function hasFormData(){return draft.some(row=>row.constant||row.terms.some(t=>t.value));}
  function resetDraft(){draft.forEach(row=>{row.constant='';row.terms.forEach(term=>{term.sign='+';term.value='';});});}
  $('linearPreset').addEventListener('change',()=>{
    const preset=$('linearPreset').value;if(!preset)return;
    if(hasFormData()&&!confirm('載入範例會取代整份表格內容，是否繼續？')){$('linearPreset').value='';return;}
    resetDraft();const data=preset==='three'?[[1,1,1,6],[2,-1,1,3],[1,2,-1,2]]:[[1,1,100],[2,3,240]],count=data.length;
    $('linearVariableCount').value=String(count);$('linearEquationCount').value=String(count);
    data.forEach((numbers,i)=>{numbers.slice(0,count).forEach((value,j)=>{draft[i].terms[j]={sign:value<0?'-':'+',value:String(Math.abs(value))};});draft[i].constant=String(numbers[count]);});
    clearResult('linear');renderRows();$('linearPreset').value='';
  });
  $('linearClearBtn').addEventListener('click',()=>{
    if($('linearEntryMode').value==='text'){
      if($('linearInput').value&&!confirm('清空文字模式的方程式？'))return;$('linearInput').value='';
    }else{
      if(hasFormData()&&!confirm('清空整份表格（包含暫時隱藏的欄位）？'))return;resetDraft();renderRows();
    }
    clearResult('linear');previewLinear();
  });
  $('linearUseFormBtn').addEventListener('click',()=>{
    try{const text=build().text;if($('linearInput').value&&!confirm('用目前表格算式取代文字模式內容？'))return;$('linearInput').value=text;clearResult('linear');previewLinear();}
    catch(error){showResult('linear','error').append(el('p','guided-result-message',error.message));reveal('linear');}
  });
  $('linearForm').addEventListener('submit',event=>{
    event.preventDefault();
    try{
      const result=M.solveLinear($('linearEntryMode').value==='text'?$('linearInput').value:build().text),output=showResult('linear',result.status);
      const messages={inconsistent:'無解：這些條件互相矛盾，請核對各條數字。',infinite:'無限多組解：獨立條件不足，無法唯一決定所有未知數。',identity:'等式成立，但沒有未知數需要求解。',uncertain:'條件太接近或數值差距過大，無法可靠判定；請調整條件或數值單位。'};
      if(result.status==='unique'){
        output.append(el('p','guided-result-title','已找到唯一解'));const answers=el('div','guided-answer-grid');
        result.vars.forEach((name,i)=>answers.append(el('div','guided-answer',name+' = '+M.format(result.values[i]))));output.append(answers,el('p','guided-result-meta','小數最多顯示 12 位有效數字；請依用途核對所需精度。'));
      }else output.append(el('p','guided-result-message',messages[result.status]));
      const original=el('details','result-original');original.append(el('summary','','核對使用的方程式'),el('pre','',result.lines.join('\n')));output.append(original);
    }catch(error){showResult('linear','error').append(el('p','guided-result-message',error.message));}
    reveal('linear');
  });
  function previewRatio() {
    const reverse=$('ratioMode').value==='reverse',base=$('ratioBaseValue').value.trim()||'X',percent=$('ratioBasePercent').value.trim()||'p',target=$('ratioTarget').value.trim()||(reverse?'q':'N');
    $('ratioDirection').textContent=reverse?'百分比 → 數值':'數值 → 百分比';
    $('ratioTargetLabel').textContent=reverse?'目標百分比 q':'目標數值 N';$('ratioTargetUnit').hidden=!reverse;$('ratioTarget').placeholder=reverse?'例如 25':'例如 50';
    $('ratioTargetHelp').textContent=reverse?'依照上方已知比例，求出這個百分比對應的數值。':'將這個數值與上方已知數值比較，求出對應百分比。';
    const relationship=$('ratioRelationship');relationship.replaceChildren();
    for(const [left,right,unknown]of [[base,percent+'%',false],[reverse?'?':target,reverse?target+'%':'?',true]]){
      const row=el('div','ratio-relationship-row');row.append(el('span',unknown&&reverse?'ratio-unknown':'',left),el('small','','對應'),el('span',unknown&&!reverse?'ratio-unknown':'',right));relationship.append(row);
    }
    $('ratioPreview').textContent=reverse?'計算方式：X × q ÷ p\n'+base+' × '+target+' ÷ '+percent:'計算方式：N ÷ X × p\n'+target+' ÷ '+base+' × '+percent+'%';
  }
  function updateBasis(){
    const whole=$('ratioBasis').value==='whole';$('ratioBasePercent').readOnly=whole;
    if(whole)$('ratioBasePercent').value='100';else $('ratioBasePercent').value=customPercent;
    $('ratioBasisHelp').textContent=whole?'完整數值對應 100%；若已知的是另一組比例，請在上方選「自訂已知比例」。':'填入你已知的對應比例，例如 200 對應 40%；不必先換算成 100%。';
  }
  $('ratioBasis').addEventListener('change',()=>{if(basis==='custom')customPercent=$('ratioBasePercent').value;basis=$('ratioBasis').value;updateBasis();clearResult('ratio');previewRatio();});
  $('ratioMode').addEventListener('change',()=>{targets[ratioDirection]=$('ratioTarget').value;ratioDirection=$('ratioMode').value;$('ratioTarget').value=targets[ratioDirection];clearResult('ratio');previewRatio();});
  for(const id of ['ratioBaseValue','ratioBasePercent','ratioTarget'])$(id).addEventListener('input',()=>{if(id==='ratioBasePercent'&&basis==='custom')customPercent=$(id).value;targets[ratioDirection]=$('ratioTarget').value;clearResult('ratio');previewRatio();});
  $('ratioExampleBtn').addEventListener('click',()=>{
    if(($('ratioBaseValue').value||$('ratioTarget').value)&&!confirm('用範例取代目前的比例數值？'))return;
    $('ratioBaseValue').value='200';$('ratioBasePercent').value=basis==='whole'?'100':'40';if(basis==='custom')customPercent='40';$('ratioTarget').value=ratioDirection==='forward'?'100':'20';targets[ratioDirection]=$('ratioTarget').value;clearResult('ratio');previewRatio();
  });
  $('ratioClearBtn').addEventListener('click',()=>{
    if(($('ratioBaseValue').value||$('ratioTarget').value||targets.forward||targets.reverse)&&!confirm('清空兩個換算方向的數值？'))return;
    $('ratioBaseValue').value='';$('ratioTarget').value='';targets.forward='';targets.reverse='';customPercent='';$('ratioBasePercent').value=basis==='whole'?'100':'';clearResult('ratio');previewRatio();
  });
  $('ratioForm').addEventListener('submit',event=>{
    event.preventDefault();
    try{
      const labels=['已知數值 X','已知百分比 p','目標條件'],values=['ratioBaseValue','ratioBasePercent','ratioTarget'].map((id,i)=>{try{return F.numeric($(id).value);}catch(error){throw new Error(labels[i]+'：'+error.message);}});
      const mode=$('ratioMode').value,result=M.ratio(mode,...values),output=showResult('ratio','success'),f=M.format,forward=mode==='forward';
      output.append(el('p','guided-result-title',forward?'目標數值所對應的百分比':'目標百分比所對應的數值'),el('p','ratio-answer',(forward?'q = ':'N = ')+f(result.value)+(forward?'%':'')),el('p','guided-result-detail',forward?'計算：'+f(result.target)+' ÷ '+f(result.x)+' × '+f(result.p)+'%':'計算：'+f(result.x)+' × '+f(result.target)+' ÷ '+f(result.p)));
    }catch(error){showResult('ratio','error').append(el('p','guided-result-message',error.message));}
    reveal('ratio');
  });
  document.addEventListener('calculator:clear-data',()=>{
    resetDraft();$('linearInput').value='';$('linearPreset').value='';renderRows();clearResult('linear');previewLinear();
    $('ratioBaseValue').value='';$('ratioTarget').value='';targets.forward='';targets.reverse='';customPercent='';
    updateBasis();clearResult('ratio');previewRatio();
  });
  renderRows();updateBasis();previewRatio();
})();
/* CALCULATOR_MATH_UI_END */
