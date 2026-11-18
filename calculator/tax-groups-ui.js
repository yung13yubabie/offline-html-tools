/* Independent general-calculation worksheet; no writes to invoice-book rows or rate settings. */
(() => {
  'use strict';
  const root = document.getElementById('taxGroupsTool');
  if (!root) return;
  const E = createTaxGroupsCore19(), rows = document.getElementById('taxGroupsRows');
  const rate = document.getElementById('taxGroupsRate'), precision = document.getElementById('taxGroupsPrecision');
  const rateError = document.getElementById('taxGroupsRateError'), totals = document.getElementById('taxGroupsTotals');
  const fields = ['netCents','taxCents','grossCents'], labels = ['未稅','稅額','含稅'];
  let sequence = 0;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function options() {return {mode:root.querySelector('[name="taxGroupsMode"]:checked').value, rate:rate.value, precision:precision.value};}
  function inputLabel() {return options().mode === 'gross' ? '輸入含稅金額' : '輸入未稅金額';}
  function renumber() {
    [...rows.children].forEach((row,index) => {
      const number = index + 1;
      row.setAttribute('aria-label','第 ' + number + ' 組稅額拆算');
      row.querySelector('.tax-groups-row-index').textContent = String(number);
      row.querySelector('.tax-groups-input-label').textContent = inputLabel();
      row.querySelector('.tax-groups-input').setAttribute('aria-label','第 ' + number + ' 組' + inputLabel());
      row.querySelector('.tax-groups-remove').setAttribute('aria-label','刪除第 ' + number + ' 組');
      fields.forEach((field,i) => row.querySelector('[data-tax-result="' + field + '"]').setAttribute('aria-label','第 ' + number + ' 組' + labels[i]));
    });
    document.getElementById('taxGroupsInputHeading').textContent = inputLabel();
    document.getElementById('taxGroupsAddBtn').disabled = rows.children.length >= E.MAX_ROWS;
  }
  function clearOutputs(row) {
    fields.forEach(field => {row.querySelector('[data-tax-result="' + field + '"]').textContent = '—';});
  }
  function setTotals(values, hasValues) {
    ['taxGroupsNetTotal','taxGroupsTaxTotal','taxGroupsGrossTotal'].forEach((id,index) => {
      document.getElementById(id).textContent = hasValues ? E.format(values[fields[index]]) : '—';
    });
  }
  function render() {
    const inputs = [...rows.querySelectorAll('.tax-groups-input')];
    let data;
    try {
      data = E.summarize(inputs.map(input => input.value), options());
      rate.removeAttribute('aria-invalid'); rateError.textContent = '';
    } catch (error) {
      rate.setAttribute('aria-invalid','true'); rateError.textContent = error.message;
      [...rows.children].forEach((row,index) => {
        const input = inputs[index], amountError = row.querySelector('.tax-groups-error');
        clearOutputs(row);
        try {
          const amount = E.parseAmount(input.value);
          input.removeAttribute('aria-invalid'); amountError.textContent = '';
          row.dataset.state = amount === null ? 'blank' : 'pending';
        } catch (amountIssue) {
          input.setAttribute('aria-invalid','true'); amountError.textContent = amountIssue.message;
          row.dataset.state = 'error';
        }
      });
      totals.dataset.state = 'error'; setTotals(null,false);
      document.getElementById('taxGroupsTotalLabel').textContent = '總計';
      document.getElementById('taxGroupsTotalNote').textContent = '請先修正稅率';
      document.getElementById('taxGroupsCount').textContent = '待修正';
      return;
    }
    data.rows.forEach((result,index) => {
      const row = rows.children[index], input = inputs[index], error = row.querySelector('.tax-groups-error');
      row.dataset.state = result.status;
      if (result.status === 'error') {
        input.setAttribute('aria-invalid','true'); error.textContent = result.error; clearOutputs(row);
      } else {
        input.removeAttribute('aria-invalid'); error.textContent = '';
        if (result.status === 'blank') clearOutputs(row);
        else fields.forEach(field => {row.querySelector('[data-tax-result="' + field + '"]').textContent = E.format(result[field]);});
      }
    });
    totals.dataset.state = data.invalidCount ? 'partial' : data.validCount ? 'ready' : 'empty';
    setTotals(data.totals,data.validCount > 0);
    document.getElementById('taxGroupsTotalLabel').textContent = data.invalidCount ? '有效列小計' : '總計';
    document.getElementById('taxGroupsTotalNote').textContent = data.invalidCount ? data.invalidCount + ' 筆待修正，未計入小計' : data.validCount ? '逐筆取稅後加總' : '空白列不計入';
    document.getElementById('taxGroupsCount').textContent = data.validCount + ' 筆有效' + (data.invalidCount ? ' · ' + data.invalidCount + ' 筆待修正' : '');
  }
  function addRow(value = '', focus = false) {
    if (rows.children.length >= E.MAX_ROWS) return null;
    const row = element('div','tax-groups-row'); row.setAttribute('role','group');
    const number = element('span','tax-groups-row-index'); number.setAttribute('aria-hidden','true');
    const field = element('label','tax-groups-field'), input = element('input','tax-groups-input');
    input.type = 'text'; input.inputMode = 'decimal'; input.maxLength = 80; input.autocomplete = 'off'; input.value = value; input.placeholder = '填入金額';
    const error = element('span','tax-groups-error'); error.id = 'tax-groups-error-' + (++sequence); error.setAttribute('role','status');
    input.setAttribute('aria-describedby',error.id);
    field.append(element('span','tax-groups-cell-label tax-groups-input-label',inputLabel()),input,error);
    row.append(number,field);
    fields.forEach((key,index) => {
      const cell = element('div','tax-groups-field'), output = element('output','tax-groups-result','—'); output.dataset.taxResult = key;
      cell.append(element('span','tax-groups-cell-label',labels[index]),output); row.append(cell);
    });
    const remove = element('button','tax-groups-remove','×'); remove.type = 'button'; row.append(remove);
    remove.addEventListener('click',() => {
      const next = row.nextElementSibling || row.previousElementSibling;
      row.remove(); if (!rows.children.length) addRow(); renumber(); render();
      (next || rows.firstElementChild).querySelector('.tax-groups-input').focus();
    });
    // Enter advances only within this worksheet; ordinary Tab and editing remain native.
    input.addEventListener('keydown',event => {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault();
      let next = row.nextElementSibling;
      if (!next) {next=addRow();renumber();render();}
      next?.querySelector('.tax-groups-input').focus();
    });
    rows.append(row); renumber();
    if (focus) input.focus();
    return row;
  }
  function reset() {rows.replaceChildren();addRow();addRow();addRow();renumber();render();}
  function setRate(value) {rate.value=String(value ?? '');render();return !rate.hasAttribute('aria-invalid');}
  function getState() {return {...options(), rows:[...rows.querySelectorAll('.tax-groups-input')].map(input=>input.value)};}
  rows.addEventListener('input',render);
  rate.addEventListener('input',render); rate.addEventListener('change',render);
  precision.addEventListener('change',render);
  root.querySelectorAll('[name="taxGroupsMode"]').forEach(input => input.addEventListener('change',()=>{renumber();render();}));
  document.getElementById('taxGroupsAddBtn').addEventListener('click',()=>{addRow('',true);render();});
  // Read and follow the existing global rate, but never change it from this worksheet.
  const sharedRate = document.getElementById('taxRateInput');
  if (sharedRate) rate.value = sharedRate.value;
  document.addEventListener('change',event => {if (event.target?.id === 'taxRateInput') setRate(event.target.value);});
  document.addEventListener('calculator:clear-data',reset);
  window.OfflineTaxGroups19 = Object.freeze({reset,setRate,getState});
  reset();
})();
