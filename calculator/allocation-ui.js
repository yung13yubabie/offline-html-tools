/* Standalone allocation UI. Drafts stay in memory and results use text nodes. */
(() => {
 const core = createAllocationCore19();
 const byName = name => document.getElementById('allocation' + name + '19');
 const fields = {start: byName('Start'), end: byName('End'), amount: byName('Amount'), unit: byName('Unit')};
 const errors = {start: byName('StartError'), end: byName('EndError'), amount: byName('AmountError'), unit: byName('UnitError')};
 const form = byName('Form'), summary = byName('Summary'), details = byName('Result');
 const copy = byName('Copy'), copyStatus = byName('CopyStatus'), fallback = byName('CopyFallback');
 const pager = byName('Pager'), live = byName('Live');
 const optionFields = {amount: byName('ShowAmount'), ratio: byName('ShowRatio'), dates: byName('ShowDates'), result: byName('ShowResult')};
 const pickers = {start: byName('StartPicker'), end: byName('EndPicker')};
 const PAGE_SIZE = 50;
 let result = null, page = 0, generation = 0, copyBusy = false, timer;

 function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
 }
 function options() {
  return Object.fromEntries(Object.entries(optionFields).map(([key, field]) => [key, field.checked]));
 }
 function setError(key, message = '') {
  if (message) fields[key].setAttribute('aria-invalid', 'true');
  else fields[key].removeAttribute('aria-invalid');
  errors[key].textContent = message;
  errors[key].hidden = !message;
 }
 function updateCopyState() {
  copy.disabled = copyBusy || !result || !Object.values(options()).some(Boolean);
 }
 function clearCopy() {
  generation++;
  copyBusy = false;
  copyStatus.textContent = '';
  fallback.value = '';
  byName('FallbackWrap').hidden = true;
 }
 function clearResult(message, state) {
  result = null;
  page = 0;
  clearCopy();
  updateCopyState();
  summary.hidden = true;
  pager.hidden = true;
  live.textContent = '';
  details.dataset.state = state;
  if (details.textContent !== message) details.replaceChildren(element('p', 'allocation-empty19', message));
 }
 function render() {
  if (!result) return;
  const show = options();
  const visible = Object.values(show).some(Boolean);
  const count = result.rows.length;
  const totalPages = Math.ceil(count / PAGE_SIZE);
  page = Math.max(0, Math.min(page, totalPages - 1));
  summary.hidden = false;
  summary.replaceChildren();
  const metrics = [
   [core.formatCents(result.amountCents), '整段總金額'],
   [result.totalDays.toLocaleString('zh-TW'), '實際總天數'],
   [count.toLocaleString('zh-TW'), result.unit === 'year' ? '年度組數' : '月份組數']
  ];
  for (const [value, label] of metrics) {
   const cell = element('div');
   cell.append(element('span', '', label), element('strong', '', value));
   summary.append(cell);
  }

  details.dataset.state = 'success';
  details.replaceChildren();
  updateCopyState();
  if (!visible) {
   details.append(element('p', 'allocation-empty19', '勾選上方項目即可顯示分攤明細。'));
   pager.hidden = true;
   return;
  }
  const list = element('div', 'allocation-rows19');
  list.setAttribute('aria-label', '分攤明細');
  for (const row of result.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)) {
   const item = element('article', 'allocation-row19');
   item.dataset.allocationKey = row.key;
   const group = element('div', 'allocation-row-group19');
   group.append(element('h3', '', row.label));
   // Dates are the context for reading a row. The date checkbox controls the copied text.
   group.append(element('p', 'allocation-row-dates19', row.start + ' ～ ' + row.end));
   const assigned = element('div', 'allocation-row-amount19');
   assigned.append(element('span', '', '分配金額'), element('strong', '', core.formatCents(row.cents)));
   const expression = core.expression(result, row, show);
   item.append(group);
   if (expression) item.append(element('p', 'allocation-equation19', expression));
   item.append(assigned);
   list.append(item);
  }
  details.append(list);
  pager.hidden = count <= PAGE_SIZE;
  byName('PageLabel').textContent = (page * PAGE_SIZE + 1) + '–' + Math.min(count, (page + 1) * PAGE_SIZE) + '／' + count + ' 筆';
  byName('Prev').disabled = page === 0;
  byName('Next').disabled = page >= totalPages - 1;
 }

 function readValues() {
  return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value.trim()]));
 }
 function missing(values) {
  return ['start', 'end', 'amount'].some(key => !values[key]);
 }
 function calculate(event) {
  event?.preventDefault();
  clearTimeout(timer);
  const values = readValues();
  if (missing(values)) {
   clearResult('填好日期及總金額後會自動分攤。', 'empty');
   return null;
  }
  try {
   const next = core.allocate(values);
   clearCopy();
   result = next;
   page = 0;
   for (const key of Object.keys(fields)) setError(key);
   render();
   live.textContent = '分攤完成，共 ' + result.totalDays + ' 天，' + result.rows.length + ' 組。';
   return result;
  } catch (error) {
   clearResult('請核對日期與金額。', 'error');
   if (errors[error.field] && document.activeElement !== fields[error.field]) setError(error.field, error.message);
   return null;
  }
 }
 function checkField(key) {
  const values = readValues();
  if (!values[key]) return;
  try {
   if (key === 'amount') core.parseAmount(values.amount);
   else {
    const date = core.parseDate(values[key], key);
    if (key === 'end' && values.start) {
     const start = core.parseDate(values.start, 'start');
     if (date.ordinal < start.ordinal) setError('end', '結束日期不能早於起始日期。');
    }
   }
  } catch (error) {
   if (errors[error.field]) setError(error.field, error.message);
  }
 }
 function changed(key, {immediate = false, composing = false} = {}) {
  clearTimeout(timer);
  setError(key);
  // The order of the interval can change when either date is edited.
  if (key === 'start') setError('end');
  const complete = !missing(readValues());
  clearResult(complete ? '正在更新分攤…' : '填好日期及總金額後會自動分攤。', complete ? 'pending' : 'empty');
  if (composing || !complete) return;
  if (immediate) calculate();
  else timer = setTimeout(calculate, 180);
 }

 function revealPicker(key, visible) {
  const picker = pickers[key];
  picker.classList.toggle('is-fallback', visible);
  picker.setAttribute('aria-hidden', String(!visible));
  picker.tabIndex = visible ? 0 : -1;
 }
 for (const [key, picker] of Object.entries(pickers)) {
  const button = document.getElementById(picker.id.replace('Picker19', 'PickerButton19'));
  button.addEventListener('click', () => {
   if (picker.classList.contains('is-fallback')) {
    revealPicker(key, false);
    return;
   }
   try { picker.value = core.parseDate(fields[key].value, key).text; }
   catch { picker.value = ''; }
   try {
    picker.showPicker();
   } catch {
    revealPicker(key, true);
    picker.focus();
   }
  });
  picker.addEventListener('change', () => {
   if (!picker.value) return;
   fields[key].value = picker.value;
   revealPicker(key, false);
   button.focus({preventScroll: true});
   changed(key, {immediate: true});
  });
 }

 function exportText() {
  return result ? core.plaintext(result, options()) : '';
 }
 async function copyText() {
  const text = exportText();
  if (!text || copyBusy) return false;
  const token = generation;
  copyBusy = true;
  updateCopyState();
  copyStatus.textContent = '';
  try {
   if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw Error('clipboard unavailable');
   await navigator.clipboard.writeText(text);
   if (token !== generation) return false;
   copyStatus.textContent = '已複製 ' + result.rows.length + ' 筆分攤明細。';
   byName('FallbackWrap').hidden = true;
   return true;
  } catch {
   if (token !== generation) return false;
   fallback.value = text;
   byName('FallbackWrap').hidden = false;
   copyStatus.textContent = '瀏覽器未允許自動複製，可選取下方文字複製。';
   fallback.focus();
   fallback.select();
   return false;
  } finally {
   if (token === generation) {
    copyBusy = false;
    updateCopyState();
   }
  }
 }
 function reset() {
  clearTimeout(timer);
  for (const key of ['amount', 'start', 'end']) fields[key].value = '';
  for (const key of Object.keys(fields)) setError(key);
  for (const [key, picker] of Object.entries(pickers)) {
   picker.value = '';
   revealPicker(key, false);
  }
  clearResult('填好日期及總金額後會自動分攤。', 'empty');
 }
 form.addEventListener('submit', calculate);
 for (const key of ['amount', 'start', 'end']) {
  fields[key].addEventListener('input', event => changed(key, {composing: event.isComposing}));
  fields[key].addEventListener('compositionend', () => changed(key));
  fields[key].addEventListener('blur', () => checkField(key));
 }
 fields.unit.addEventListener('change', () => changed('unit', {immediate: true}));
 for (const option of Object.values(optionFields)) {
  option.addEventListener('change', () => { clearCopy(); render(); });
 }
 copy.addEventListener('click', copyText);
 byName('Prev').addEventListener('click', () => {
  if (result && page > 0) { page--; render(); }
 });
 byName('Next').addEventListener('click', () => {
  if (result && (page + 1) * PAGE_SIZE < result.rows.length) { page++; render(); }
 });
 document.addEventListener('calculator:clear-data', reset);
 window.OfflineAllocation19 = Object.freeze({
  core, calculate, reset, copyText, exportText,
  getSnapshot: () => result ? {
   ...result,
   amountCents: result.amountCents.toString(),
   page,
   rows: result.rows.map(row => ({...row, cents: row.cents.toString(), baseCents: row.baseCents.toString(), remainder: row.remainder.toString()}))
  } : null
 });
})();
