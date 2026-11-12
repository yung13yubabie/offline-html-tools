/* Date tools: all displayed strings are text nodes; no runtime dependencies. */
(() => {
  'use strict';
  const E = DateToolsEngine, $ = id => document.getElementById(id);
  const weekdays = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function number(value) {return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',').replace('-', '−');}
  function reset(result) {
    result.dataset.state = 'stale';
    result.replaceChildren(element('p','date-result-stale','日期或條件已變更，請重新計算。'));
  }
  function error(result, message) {
    result.dataset.state = 'error';
    result.replaceChildren(element('p','date-result-error',message));
  }
  function calculateDifference(event) {
    event.preventDefault();
    const result = $('dateDiffResult');
    try {
      const data = E.difference({start:$('dateDiffStart').value,end:$('dateDiffEnd').value,mode:$('dateDiffMode').value,includeStart:$('dateDiffIncludeStart').checked});
      const figure = element('p','date-result-number',number(data.days));
      figure.append(element('span','',data.mode === 'business' ? '個工作日' : '天'));
      const detail = data.start + ' → ' + data.end + '\n' + (data.includeStart ? '含起日與結束日' : '不含起日，含結束日') + (data.direction < 0 ? '；倒算，以負數表示。' : '。');
      result.dataset.state = 'success';
      result.replaceChildren(element('p','date-result-label',data.mode === 'business' ? '排除週末後的天數' : '相差日曆天數'),figure,element('p','date-result-detail',detail));
      if (data.mode === 'business') result.append(element('p','date-result-detail','已略過 ' + number(data.excludedWeekendDays) + ' 個週末日；只計週一至週五，未排除國定假日。'));
      if (data.start === data.end && data.days === 0) result.append(element('p','date-result-detail',data.includeStart ? '起日是週末，因此工作日為 0。' : '起日與結束日相同，不含起日時為 0 天。'));
    } catch (exception) {error(result,exception.message);}
  }
  function calculateShift(event) {
    event.preventDefault();
    const result = $('dateShiftResult');
    try {
      const data = E.shift({start:$('dateShiftStart').value,amount:$('dateShiftAmount').value,mode:$('dateShiftMode').value});
      let operation = data.amount > 0 ? '往後加 ' + number(data.amount) : data.amount < 0 ? '往前減 ' + number(-data.amount) : '加減 0';
      operation += data.mode === 'business' ? ' 個工作日' : ' 天';
      result.dataset.state = 'success';
      result.replaceChildren(element('p','date-result-label','推算日期'),element('p','date-result-number date-result-date',data.date),element('p','date-result-weekday',weekdays[data.weekday]),element('p','date-result-detail',data.start + '，' + operation + '。'));
      if (data.amount === 0) result.append(element('p','date-result-detail','0 天保留原日期，週末起日也不會自動順延。'));
      else if (data.mode === 'business') result.append(element('p','date-result-detail','實際跨越 ' + number(Math.abs(data.calendarDays)) + ' 個日曆天，略過 ' + number(data.excludedWeekendDays) + ' 個週末日；未排除國定假日。'));
    } catch (exception) {error(result,exception.message);}
  }
  document.addEventListener('calculator:clear-data',()=>{
    ['dateDiffStart','dateDiffEnd','dateShiftStart','dateShiftAmount'].forEach(id=>{$(id).value='';});
    reset($('dateDiffResult'));reset($('dateShiftResult'));
  });
  const now = new Date();
  // Browser-local calendar date, not UTC's possibly different day.
  const today = String(now.getFullYear()).padStart(4, '0') + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  ['dateDiffStart','dateDiffEnd','dateShiftStart'].forEach(id => {$(id).value = today;});
  [['dateDiffForm','dateDiffResult',calculateDifference],['dateShiftForm','dateShiftResult',calculateShift]].forEach(([formId,resultId,handler]) => {
    const form = $(formId);
    form.addEventListener('submit',handler);
    form.addEventListener('input',() => reset($(resultId)));
    form.addEventListener('change',() => reset($(resultId)));
  });
})();
