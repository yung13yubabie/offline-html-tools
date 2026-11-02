/* Number-pool UI. This file is inlined into the downloadable HTML. */
(() => {
  'use strict';
  const E = NumberPoolEngine, $ = id => document.getElementById(id);
  const rows = $('poolRows'), resultBox = $('poolResults');
  let mode = 'add', sequence = 0, worker = null, workerURL = '', generation = 0, latest = null;
  const modes = {
    add: {name:'加法', help:'從清單挑選數字相加，每筆最多使用一次。'},
    subtract: {name:'減法', help:'挑一筆作為起始數字，再扣除其他選中的數字；每筆最多使用一次，也可只選一筆。'},
    mixed: {name:'混合', help:'每筆可選擇加、減或不使用，至少選一筆；正負號不同會視為不同組合。'}
  };
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function status(message, state = '') {
    $('poolStatus').textContent = message;
    $('poolStatus').dataset.state = state;
    if (state === 'error' && $('poolPanel').classList.contains('active')) $('poolStatus').scrollIntoView({block:'center'});
  }
  function stop() {
    generation++;
    if (worker) worker.terminate();
    worker = null;
    if (workerURL) URL.revokeObjectURL(workerURL);
    workerURL = '';
    $('poolBusy').hidden = true;
    $('poolCancelBtn').hidden = true;
    $('poolSearchBtn').disabled = false;
    resultBox.removeAttribute('aria-busy');
  }
  function invalidate() {
    const hadResult = latest !== null || worker !== null;
    stop(); latest = null;
    $('poolExportBtn').disabled = true;
    $('poolSummary').hidden = true;
    if (hadResult || $('poolStatus').dataset.state === 'stale') {
      resultBox.replaceChildren();
      status('條件已變更，請重新搜尋。清單與原始名稱已保留。', 'stale');
    } else if ($('poolStatus').dataset.state === 'error') {
      status('修改完成後，按「找出組合」重新搜尋。');
    }
    updateCount();
  }
  function updateCount() {
    const count = [...rows.children].filter(row => row.querySelector('.pool-value').value.trim() || row.querySelector('.pool-name').value).length;
    $('poolCount').textContent = count + ' 筆';
    $('poolLimits').textContent = modes[mode].name + '最多 ' + E.limits[mode] + ' 筆；每個數字絕對值上限 10 億，最多 4 位小數。相同金額仍視為不同筆資料。';
    $('poolAddBtn').disabled = rows.children.length >= 32;
    [...rows.children].forEach((row,index) => {
      row.querySelector('.pool-name').setAttribute('aria-label', '第 ' + (index+1) + ' 筆名稱或說明');
      row.querySelector('.pool-value').setAttribute('aria-label', '第 ' + (index+1) + ' 筆數字');
      row.querySelector('.pool-remove').setAttribute('aria-label', '移除第 ' + (index+1) + ' 筆');
    });
  }
  function addRow(name = '', value = '', focus = false) {
    const row = el('div', 'pool-entry'); row.dataset.id = 'pool-row-' + (++sequence);
    const nameInput = el('textarea', 'pool-name');
    nameInput.rows = 1; nameInput.maxLength = 2000; nameInput.placeholder = '名稱或說明'; nameInput.value = name;
    const valueInput = el('input', 'pool-value pool-entry-value');
    valueInput.inputMode = 'decimal'; valueInput.maxLength = 80; valueInput.placeholder = '0'; valueInput.value = value;
    const remove = el('button', 'pool-remove', '×'); remove.type = 'button';
    remove.addEventListener('click', () => {
      const next = row.nextElementSibling || row.previousElementSibling;
      row.remove(); if (!rows.children.length) addRow();
      invalidate(); (next || rows.firstElementChild).querySelector('.pool-name').focus();
    });
    row.append(nameInput, valueInput, remove); rows.append(row);
    const resize = () => {nameInput.style.height = 'auto'; nameInput.style.height = Math.max(46, nameInput.scrollHeight + 2) + 'px';};
    nameInput.addEventListener('input', resize);
    // A hidden panel has no scrollHeight; resize names when it becomes visible too.
    if ($('poolPanel').classList.contains('active')) resize();
    updateCount(); if (focus) nameInput.focus();
  }
  function setMode(next) {
    mode = next;
    document.querySelectorAll('[data-pool-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.poolMode === mode)));
    $('poolModeHelp').textContent = modes[mode].help;
    invalidate();
  }
  function importLines() {
    const kind = $('poolDelimiter').value;
    const delimiter = kind === 'custom' ? $('poolCustomDelimiter').value : kind === 'tab' ? '\t' : kind;
    const feedback = $('poolImportStatus');
    feedback.dataset.state = 'error';
    if (!delimiter && kind === 'custom') {feedback.textContent = '請先填入自訂分隔符號。';return;}
    const parsed = E.parseLines($('poolPaste').value, delimiter);
    if (parsed.errors.length) {
      feedback.textContent = parsed.errors.map(error => (error.line ? '第 ' + error.line + ' 行：' : '') + error.message).join('\n') + '\n尚未匯入任何資料，請修正後再試。';
      return;
    }
    if (!parsed.items.length) {feedback.textContent = '請先貼上至少一筆數字。';return;}
    const existing = [...rows.children].filter(row => row.querySelector('.pool-value').value.trim() || row.querySelector('.pool-name').value);
    if (existing.length + parsed.items.length > 32) {feedback.textContent = '清單最多保留 32 筆。此次未匯入，請先縮小資料範圍。';return;}
    [...rows.children].filter(row => !existing.includes(row)).forEach(row => row.remove());
    parsed.items.forEach(item => addRow(item.name, E.format(item.value)));
    invalidate();
    feedback.dataset.state = 'success';
    feedback.textContent = '已新增 ' + parsed.items.length + ' 筆。現有資料與貼上原文皆已保留。';
  }
  function snapshot() {
    let target, tolerance;
    try {target = E.parseNumber($('poolTarget').value);} catch(error) {throw new Error('目標數字：' + error.message);}
    try {tolerance = $('poolTolerance').value.trim() ? E.parseNumber($('poolTolerance').value) : Infinity;} catch(error) {throw new Error('允許差額：' + error.message);}
    if (tolerance < 0) throw new Error('允許差額請填 0 或正數。');
    const items = [];
    [...rows.children].forEach((row,index) => {
      const name = row.querySelector('.pool-name').value, raw = row.querySelector('.pool-value').value;
      if (!name && !raw.trim()) return;
      try {items.push({id:row.dataset.id, name, value:E.parseNumber(raw), row:index+1});}
      catch(error) {throw new Error('第 ' + (index+1) + ' 筆：' + error.message);}
    });
    if (!items.length) throw new Error('請先加入至少一筆數字。');
    if (items.length > E.limits[mode]) throw new Error(modes[mode].name + '模式最多 ' + E.limits[mode] + ' 筆，目前有 ' + items.length + ' 筆。請縮小清單或切換模式。');
    return {items, target, tolerance, mode, limit:100};
  }
  function termsFor(solution, data) {
    return data.mode === 'subtract' ? [...solution.terms].sort((a,b) => b.sign-a.sign || a.index-b.index) : solution.terms;
  }
  function expression(solution, data) {
    return termsFor(solution, data).map((term,index) => {
      const number = data.items[term.index].value, formatted = E.format(number);
      const value = number < 0 ? '(' + formatted + ')' : formatted;
      return (index === 0 ? term.sign < 0 ? '− ' : '' : term.sign < 0 ? ' − ' : ' + ') + value;
    }).join('');
  }
  function signed(value) {return value > 0 ? '+' + E.format(value) : E.format(value);}
  function render(result, data) {
    latest = {result, data}; resultBox.replaceChildren();
    $('poolExportBtn').disabled = !result.solutions.length;
    $('poolSummary').replaceChildren(); $('poolSummary').hidden = false;
    const exact = result.solutions.filter(solution => solution.difference === 0).length;
    [[E.format(data.target),'目標數字'],[String(result.solutions.length),'顯示組合'],[String(exact),'其中完全符合']].forEach(([value,label]) => {
      const item = el('div'); item.append(el('strong','',value), el('span','',label)); $('poolSummary').append(item);
    });
    status(result.truncated ? '符合範圍的組合超過 100 組，目前顯示最接近目標的 100 組；同差額優先顯示筆數較少的組合。可縮小差額或清單再搜尋。' : '已比對完成，共 ' + result.solutions.length + ' 組' + (data.tolerance === Infinity ? '（不限差額）' : '符合 ±' + E.format(data.tolerance) + ' 的範圍') + '。依差額由小到大排列，同差額優先顯示筆數較少的組合。');
    if (!result.solutions.length) {resultBox.append(el('p','pool-no-results','這個範圍內沒有組合。試著放寬「允許差額」，或檢查目標與清單。'));return;}
    const groups = new Map();
    result.solutions.forEach(solution => {
      const diff = Math.abs(solution.difference);
      if (!groups.has(diff)) groups.set(diff, []);
      groups.get(diff).push(solution);
    });
    let groupIndex = 0, solutionIndex = 0;
    groups.forEach((solutions,difference) => {
      const details = el('details','pool-group'); details.dataset.exact = String(difference === 0); details.dataset.difference = String(difference / E.SCALE); details.open = groupIndex++ === 0;
      const summary = el('summary','',difference === 0 ? '完全符合' : '差 ' + E.format(difference));
      summary.append(el('span','', solutions.length + ' 組')); details.append(summary);
      const body = el('div','pool-group-body');
      solutions.forEach(solution => {
        const card = el('article','pool-solution');
        const heading = el('div','pool-solution-top'); heading.append(el('span','','組合 ' + (++solutionIndex) + ' · ' + solution.terms.length + ' 筆'),el('span','',solution.difference === 0 ? '差額 0' : '合計 − 目標：' + signed(solution.difference)));
        const equation = el('div','pool-equation',expression(solution,data) + ' = '); equation.append(el('strong','',E.format(solution.total)));
        const terms = el('ul','pool-terms');
        termsFor(solution,data).forEach(term => {
          const item = data.items[term.index], li = el('li'), label = el('div');
          label.append(el('div','pool-term-name',item.name || '未填名稱'),el('span','pool-source','清單第 ' + item.row + ' 筆'));
          li.append(label,el('span','pool-term-value',(term.sign > 0 ? '+ ' : '− ') + (item.value < 0 ? '(' + E.format(item.value) + ')' : E.format(item.value))));
          terms.append(li);
        });
        card.append(heading,equation,terms); body.append(card);
      });
      details.append(body); resultBox.append(details);
    });
  }
  function search() {
    stop(); latest = null; $('poolExportBtn').disabled = true;
    $('poolSummary').hidden = true; resultBox.replaceChildren();
    let data;
    try {data = snapshot();} catch(error) {status(error.message, 'error');return;}
    const request = generation;
    status('正在搜尋 ' + data.items.length + ' 筆數字的' + modes[data.mode].name + '組合…');
    $('poolBusy').hidden = false; $('poolCancelBtn').hidden = false; $('poolSearchBtn').disabled = true; resultBox.setAttribute('aria-busy','true');
    try {
      const code = 'const engine = (' + createNumberPoolEngine.toString() + ')(); self.onmessage = event => {try {self.postMessage({result:engine.solve(event.data)});} catch(error) {self.postMessage({error:error.message});}};';
      workerURL = URL.createObjectURL(new Blob([code], {type:'text/javascript'}));
      worker = new Worker(workerURL);
      worker.onmessage = event => {
        if (request !== generation) return;
        stop();
        if (event.data.error) status(event.data.error,'error'); else {
          render(event.data.result,data);
          if (matchMedia('(max-width: 1199px)').matches && $('poolPanel').classList.contains('active')) $('poolStatus').closest('section').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
        }
      };
      worker.onerror = event => {
        if (request !== generation) return;
        event.preventDefault(); stop(); status('背景搜尋無法啟動。請用近期版本的 Chrome、Edge、Firefox 或 Safari 開啟這份 HTML 再試一次。清單已保留。','error');
      };
      worker.postMessage(data);
    } catch(error) {
      stop(); status('目前瀏覽器無法啟動背景搜尋。請用近期版本瀏覽器開啟這份 HTML。清單已保留。','error');
    }
  }
  function loadExample() {
    const hasData = [...rows.children].some(row => row.querySelector('.pool-value').value || row.querySelector('.pool-name').value);
    if (hasData && !confirm('載入範例會取代下方清單，是否繼續？')) return;
    invalidate(); rows.replaceChildren(); $('poolTarget').value = '1000'; $('poolTolerance').value = '2'; setMode('add');
    [['貨款 A','600'],['貨款 B','400'],['備用品','250'],['設備尾款','751'],['運費與包材','249']].forEach(([name,value]) => addRow(name,value));
    status('範例已載入。按「找出組合」看看完全符合與差 1 的結果。');
    $('poolSearchBtn').focus();
  }
  $('poolExportBtn').addEventListener('click', () => {
    if (!latest) return;
    const {result,data} = latest;
    const lines = ['數字池結果','模式：' + modes[data.mode].name,'目標：' + E.format(data.target),'允許差額：' + (data.tolerance === Infinity ? '不限' : '±' + E.format(data.tolerance)),result.truncated ? '顯示最接近的 100 組，符合範圍的組合尚未全部列出。' : '範圍內全部 ' + result.solutions.length + ' 組。',''];
    result.solutions.forEach((solution,index) => {
      lines.push('組合 ' + (index+1) + '｜' + (solution.difference === 0 ? '完全符合' : '差 ' + E.format(Math.abs(solution.difference)) + '（合計 − 目標：' + signed(solution.difference) + '）'), expression(solution,data) + ' = ' + E.format(solution.total));
      termsFor(solution,data).forEach(term => {const item = data.items[term.index];lines.push((term.sign>0?'+ ':'− ') + E.format(item.value) + '｜' + (item.name || '未填名稱') + '（清單第 ' + item.row + ' 筆）');});
      lines.push('');
    });
    const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\n')],{type:'text/plain;charset=utf-8'}));
    const link = el('a'); link.href = url; link.download = '數字池結果.txt'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),30000);
  });
  rows.addEventListener('input', invalidate);
  [$('poolTarget'),$('poolTolerance')].forEach(input => input.addEventListener('input',invalidate));
  document.querySelectorAll('[data-pool-mode]').forEach(button => button.addEventListener('click',() => setMode(button.dataset.poolMode)));
  $('poolAddBtn').addEventListener('click',() => {if (rows.children.length >= 32) return; addRow('','',true); invalidate();});
  $('poolClearBtn').addEventListener('click',() => {
    if ([...rows.children].some(row => row.querySelector('.pool-value').value || row.querySelector('.pool-name').value) && !confirm('清空數字清單？貼上區的原文會保留。')) return;
    invalidate(); rows.replaceChildren(); addRow('','',true); updateCount();
  });
  $('poolDelimiter').addEventListener('change',() => {$('poolCustomWrap').hidden = $('poolDelimiter').value !== 'custom'; $('poolImportStatus').textContent = '';});
  $('poolImportBtn').addEventListener('click',importLines);
  $('poolSearchBtn').addEventListener('click',search);
  $('poolCancelBtn').addEventListener('click',() => {stop(); status('已取消搜尋，輸入內容已保留。');});
  resultBox.addEventListener('click',event => {if (event.target.closest('#poolExampleBtn')) loadExample();});
  document.querySelectorAll('[data-workspace-go]').forEach(button => button.addEventListener('click',() => {
    const target = button.dataset.workspaceGo;
    document.querySelector('[data-panel="' + (target === 'poolPanel' ? target : 'generalPanel') + '"]').click();
    if (target !== 'poolPanel') {$(target).open = true; $(target).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'}); $(target).querySelector('summary').focus({preventScroll:true});}
    else $('poolTarget').focus();
  }));
  const navButtons = [...document.querySelectorAll('.mode-switch button')];
  navButtons.forEach((button,index) => {
    button.setAttribute('aria-controls',button.dataset.panel); button.setAttribute('aria-pressed',String(button.classList.contains('active')));
    button.addEventListener('click',() => {
      navButtons.forEach(nav => nav.setAttribute('aria-pressed',String(nav === button)));
      if (button.dataset.panel === 'poolPanel') rows.querySelectorAll('.pool-name').forEach(input => {input.style.height='auto';input.style.height=Math.max(46,input.scrollHeight+2)+'px';});
    });
    button.addEventListener('keydown',event => {
      const step = ['ArrowRight','ArrowDown'].includes(event.key)?1:['ArrowLeft','ArrowUp'].includes(event.key)?-1:0;
      if (!step && !['Home','End'].includes(event.key)) return;
      event.preventDefault(); const next = event.key==='Home'?0:event.key==='End'?navButtons.length-1:(index+step+navButtons.length)%navButtons.length;
      navButtons[next].focus(); navButtons[next].click();
    });
  });
  addRow(); addRow(); addRow();
})();
