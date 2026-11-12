/* Clear calculation data in place; preferences and annotations stay in this page. */
(()=>{
 'use strict';
 const button=document.getElementById('clearCalculationsBtn');
 button.addEventListener('click',()=>{
  if(!confirm('清除所有計算資料與結果？\n稅率、輸入設定、冊別分類及修改標註會保留。'))return;
  document.dispatchEvent(new Event('calculator:clear-data'));
  toast('計算資料已清除，設定已保留');
 });
 document.addEventListener('calculator:clear-data',()=>{
  exitBookFocus(activeFocusBook(),false);
  calcExpr='';calcValue=0;memory=0;calcError.textContent='';renderCalc();
  activeBatchInput=null;batchRows.replaceChildren();addBatchRow();
  batchCalcExpr.value='';refreshBatchMini();batchCalcPanel.classList.add('hidden');
  state.warningCursor=-1;state.lastFocus={sales:null,input:null};
  document.getElementById('carryoverInput').value='';
  document.querySelectorAll('#taxPanel .book').forEach(book=>{
   const def=catById(book.closest('.category').dataset.cat);
   renderBookGrid(book,def);updateBookSummary(book,def);
  });
  updateAllSummaries();updateTaxTotals();
  for(const id of ['salaryBracketInput','laborTotalInput','laborExactInput','healthTotalInput','healthExactInput'])document.getElementById(id).value='';
  renderBracketLookup();renderInsurance('labor');renderInsurance('health');
 });
})();
