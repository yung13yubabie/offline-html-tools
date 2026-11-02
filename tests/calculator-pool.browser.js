'use strict';
// Loaded by browser-smoke.cjs after Playwright is installed. All rows are synthetic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async function calculatorPool(p) {
  const output = path.resolve(__dirname, '..', 'test-results', 'browser');
  fs.mkdirSync(output, {recursive: true});
  const initialViewport = p.viewportSize();
  const initialCalculator = {
    expression: await p.locator('#calcExpression').textContent(),
    result: await p.locator('#calcResult').textContent()
  };
  const entries = p.locator('#poolRows .pool-entry');
  const snapshot = () => entries.evaluateAll(rows => rows.map(row => ({
    name: row.querySelector('.pool-name').value,
    value: row.querySelector('.pool-value').value
  })));
  const capture = name => p.screenshot({path: path.join(output, 'accounting-calculator-pool-' + name + '.png'), fullPage: false, animations: 'disabled'});
  const settle = () => p.waitForFunction(() => !document.getElementById('poolSearchBtn').disabled && document.getElementById('poolBusy').hidden);
  const search = async () => {await p.locator('#poolSearchBtn').click(); await settle();};
  const successfulSearch = async () => {
    await search();
    assert.notEqual(await p.locator('#poolStatus').getAttribute('data-state'), 'error', await p.locator('#poolStatus').textContent());
  };
  const equations = locator => locator.locator('.pool-equation').allTextContents();
  const compact = texts => texts.map(text => text.replace(/[\s,]/g, ''));
  async function configure(rows, target, {mode = 'add', tolerance = '0'} = {}) {
    const old = await snapshot();
    if (old.some(row => row.name || row.value)) p.once('dialog', dialog => dialog.accept());
    await p.locator('#poolClearBtn').click();
    await p.locator('#poolTarget').fill(String(target));
    await p.locator('#poolTolerance').fill(String(tolerance));
    await p.locator('[data-pool-mode="' + mode + '"]').click();
    for (let index = 0; index < rows.length; index++) {
      if (index) await p.locator('#poolAddBtn').click();
      await entries.nth(index).locator('.pool-name').fill(rows[index][0]);
      await entries.nth(index).locator('.pool-value').fill(String(rows[index][1]));
    }
  }
  async function assertError(pattern) {
    await search();
    assert.equal(await p.locator('#poolStatus').getAttribute('data-state'), 'error');
    assert.match(await p.locator('#poolStatus').textContent(), pattern);
    assert.equal(await p.locator('.pool-solution').count(), 0, 'Invalid input must not retain old answers');
    assert(await p.locator('#poolExportBtn').isDisabled());
  }
  async function assertStale() {
    assert.equal(await p.locator('#poolStatus').getAttribute('data-state'), 'stale');
    assert.equal(await p.locator('.pool-solution').count(), 0, 'Editing must invalidate visible calculations');
    assert(await p.locator('#poolSummary').isHidden());
    assert(await p.locator('#poolExportBtn').isDisabled());
  }
  try {
    await p.locator('.mode-switch [data-panel="poolPanel"]').click();
    await p.locator('#poolPanel').waitFor({state: 'visible'});
    assert.equal(await p.locator('.mode-switch [data-panel="poolPanel"]').getAttribute('aria-pressed'), 'true');
    await p.locator('#poolExampleBtn').click();
    assert.equal(await p.locator('#poolTarget').inputValue(), '1000');
    assert.equal(await p.locator('#poolTolerance').inputValue(), '2');
    assert.deepEqual((await snapshot()).map(row => row.value), ['600', '400', '250', '751', '249']);
    await successfulSearch();
    assert.deepEqual(await p.locator('.pool-group').evaluateAll(groups => groups.map(group => group.dataset.difference)), ['0', '1']);
    const exact = p.locator('.pool-group[data-exact="true"]');
    assert.deepEqual(compact(await equations(exact)).sort(), ['600+400=1000', '751+249=1000'].sort());
    assert.equal(await exact.locator('.pool-solution').count(), 2);
    assert.notEqual(await exact.getAttribute('open'), null, 'Exact group opens initially');
    const nearby = p.locator('.pool-group[data-difference="1"]');
    assert.equal(await nearby.getAttribute('open'), null, 'Additional groups start collapsed');
    await nearby.locator(':scope > summary').focus();
    await p.keyboard.press('Enter');
    assert.notEqual(await nearby.getAttribute('open'), null, 'Groups expand from the keyboard');
    assert.deepEqual(compact(await equations(nearby)), ['250+751=1001']);
    await nearby.locator(':scope > summary').click();
    assert.equal(await nearby.getAttribute('open'), null, 'Groups collapse by clicking');
    await exact.scrollIntoViewIfNeeded();
    await capture('results-desktop');

    // Export must contain actual calculations and original descriptions, not only a result count.
    const [download] = await Promise.all([p.waitForEvent('download'), p.locator('#poolExportBtn').click()]);
    assert.equal(await download.failure(), null);
    const exported = fs.readFileSync(await download.path(), 'utf8');
    assert.match(exported, /600 \+ 400 = 1,000/);
    assert.match(exported, /貨款 A/);
    assert.match(exported, /設備尾款/);

    await p.locator('#poolTarget').fill('1001');
    await assertStale();
    assert.deepEqual((await snapshot()).map(row => row.value), ['600', '400', '250', '751', '249']);

    // One source row per result makes both directions of each absolute difference observable.
    await configure([['低二',998],['低一',999],['正好',1000],['高一',1001],['高二',1002]], '1000', {tolerance:'2'});
    await successfulSearch();
    assert.deepEqual(await p.locator('.pool-group').evaluateAll(groups => groups.map(group => group.dataset.difference)), ['0','1','2']);
    assert.equal(await p.locator('.pool-group[data-difference="1"] .pool-solution').count(), 2);
    assert.equal(await p.locator('.pool-group[data-difference="2"] .pool-solution').count(), 2);
    const signedDifferences = await p.locator('.pool-group[data-difference="2"] .pool-solution-top').allTextContents();
    assert(signedDifferences.some(text => text.includes('−2')) && signedDifferences.some(text => text.includes('+2')), 'Show whether each result is above or below the target');

    // Import appends atomically, preserving manual rows, exact name whitespace, and pasted text.
    await configure([['既有說明不可覆蓋',5]], '20');
    await p.locator('.pool-import > summary').click();
    await p.locator('#poolDelimiter').selectOption('custom');
    await p.locator('#poolCustomDelimiter').fill('::');
    const pasted = '  附件::採購  ::12.5\n2.5';
    await p.locator('#poolPaste').fill(pasted);
    await p.locator('#poolImportBtn').click();
    assert.deepEqual(await snapshot(), [
      {name:'既有說明不可覆蓋',value:'5'},
      {name:'  附件::採購  ',value:'12.5'},
      {name:'',value:'2.5'}
    ]);
    assert.equal(await p.locator('#poolPaste').inputValue(), pasted);
    await successfulSearch();
    assert.deepEqual(compact(await equations(p.locator('#poolResults'))), ['5+12.5+2.5=20']);
    assert((await p.locator('.pool-term-name').allTextContents()).includes('  附件::採購  '));
    const importedBeforeError = await snapshot();
    await p.locator('#poolPaste').fill('正常::1\n錯誤::不是數字');
    await p.locator('#poolImportBtn').click();
    assert.match(await p.locator('#poolImportStatus').textContent(), /第 2 行/);
    assert.deepEqual(await snapshot(), importedBeforeError, 'Invalid paste must not partially append valid rows');
    await p.locator('#poolDelimiter').selectOption('|');
    await p.locator('#poolPaste').fill('半形|0');
    await p.locator('#poolImportBtn').click();
    await p.locator('#poolDelimiter').selectOption('｜');
    await p.locator('#poolPaste').fill('全形｜0');
    await p.locator('#poolImportBtn').click();
    await p.locator('#poolDelimiter').selectOption('tab');
    await p.locator('#poolPaste').fill('試算表\t0');
    await p.locator('#poolImportBtn').click();
    assert.deepEqual((await snapshot()).slice(-3), [{name:'半形',value:'0'},{name:'全形',value:'0'},{name:'試算表',value:'0'}]);
    await entries.last().locator('.pool-remove').click();
    assert.equal(await entries.count(), 5, 'Remove affects exactly one source row');

    await configure([['起始數字',100],['扣除數字',40],['其他數字',7]], '60', {mode:'subtract'});
    await successfulSearch();
    assert.deepEqual(compact(await equations(p.locator('#poolResults'))), ['100−40=60']);
    assert.match(await p.locator('#poolModeHelp').textContent(), /起始/);
    await configure([['第一筆',10],['第二筆',7],['扣除項目',3]], '14', {mode:'mixed'});
    await successfulSearch();
    assert.deepEqual(compact(await equations(p.locator('#poolResults'))), ['10+7−3=14']);
    await p.locator('[data-pool-mode="add"]').click();
    await assertStale();
    await successfulSearch();
    assert.equal(await p.locator('.pool-solution').count(), 0);
    assert(await p.locator('.pool-no-results').isVisible());
    await configure([['較低數字',5],['較高數字',20]], '12', {tolerance:''});
    await successfulSearch();
    assert.deepEqual(await p.locator('.pool-group').evaluateAll(groups => groups.map(group => group.dataset.difference)), ['7','8','13'], 'Blank tolerance searches every distance, nearest first');
    assert.deepEqual(compact(await equations(p.locator('#poolResults'))), ['5=5','20=20','5+20=25']);
    assert.match(await p.locator('#poolStatus').textContent(), /不限差額/);
    const [unlimitedDownload]=await Promise.all([p.waitForEvent('download'),p.locator('#poolExportBtn').click()]);
    assert.equal(await unlimitedDownload.failure(),null);
    const unlimitedText=fs.readFileSync(await unlimitedDownload.path(),'utf8');
    assert.match(unlimitedText,/允許差額：不限/);
    assert.match(unlimitedText,/5 \+ 20 = 25/);
    assert(!unlimitedText.includes('Infinity'),'Unlimited tolerance must have a readable exported label');
    await configure([['零點一','0.1'],['零點二','0.2']], '0.3');
    await successfulSearch();
    assert.deepEqual(compact(await equations(p.locator('#poolResults'))), ['0.1+0.2=0.3']);
    await configure([['負數','-5'],['正數','10']], '5');
    await successfulSearch();
    assert.deepEqual(compact(await equations(p.locator('#poolResults'))), ['(−5)+10=5']);

    // Errors must name the offending field or row, preserve the draft, and remove stale output.
    await p.locator('#poolTarget').fill(''); await assertError(/目標/);
    await p.locator('#poolTarget').fill('5');
    await p.locator('#poolTolerance').fill('-1'); await assertError(/差額/);
    await p.locator('#poolTolerance').fill('0');
    await entries.first().locator('.pool-value').fill('0.00001'); await assertError(/第 1 筆/);
    assert.equal(await entries.first().locator('.pool-name').inputValue(), '負數');
    await entries.first().locator('.pool-value').fill('5');
    await entries.last().locator('.pool-value').fill(''); await assertError(/第 2 筆/);

    // Duplicate values retain separate source descriptions; names are literal and comfortably readable.
    const literalName = '  <img src=x onerror="window.__poolInjected=1"> 附件說明  ';
    const longName = '這份附件的說明需要完整保留，不能被金額覆蓋，也不能縮成難以閱讀的小字。'.repeat(3);
    await configure([[literalName,500],[longName,500],['共同數字',500]], '1000');
    await successfulSearch();
    assert.equal(await p.locator('.pool-solution').count(), 3, 'Identical amounts are three separate row-pair choices');
    assert((await p.locator('.pool-term-name').allTextContents()).includes(literalName));
    assert((await p.locator('.pool-term-name').allTextContents()).includes(longName));
    assert.equal(await p.locator('#poolResults img').count(), 0, 'Names must use text nodes');
    assert.equal(await p.evaluate(() => window.__poolInjected), undefined);
    await p.setViewportSize({width:390,height:844});
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), 'Number-pool must not widen the 390px viewport');
    for (const selector of ['.pool-name','.pool-value','.pool-term-name']) {
      assert(await p.locator(selector).evaluateAll(nodes => nodes.every(node => parseFloat(getComputedStyle(node).fontSize)>=16)), 'Names and input values must remain at least 16px on mobile: '+selector);
    }
    assert(await p.locator('.pool-term-name').evaluateAll(nodes => nodes.every(node => {
      const rect=node.getBoundingClientRect(); return rect.left>=0 && rect.right<=innerWidth+1 && node.scrollWidth<=node.clientWidth+1;
    })), 'Long original names must wrap within the viewport');
    await p.locator('.pool-solution').first().scrollIntoViewIfNeeded();
    await capture('names-mobile');
    await p.setViewportSize(initialViewport);

    await configure(Array.from({length:7},(_,index)=>['零數字 '+(index+1),0]), '0');
    await successfulSearch();
    assert.equal(await p.locator('.pool-solution').count(),100);
    assert.match(await p.locator('#poolStatus').textContent(),/超過 100 組/,'Bounded output must disclose that additional combinations exist');

    // Real Worker searches above stay separate from deterministic race/cancellation fault injection.
    await configure([['保留原始名稱',5]], '5');
    await p.evaluate(() => {
      window.__poolRealWorker=window.Worker;
      window.__poolTestWorkers=[];
      window.Worker=class {
        constructor(url){this.url=url;this.terminated=false;window.__poolTestWorkers.push(this);}
        postMessage(data){this.data=data;}
        terminate(){this.terminated=true;}
      };
    });
    await p.locator('#poolSearchBtn').click();
    assert(await p.locator('#poolBusy').isVisible());
    assert(await p.locator('#poolSearchBtn').isDisabled());
    await p.locator('#poolCancelBtn').click();
    await settle();
    assert.match(await p.locator('#poolStatus').textContent(), /取消/);
    assert(await p.evaluate(() => window.__poolTestWorkers[0].terminated));
    const cancelledStatus=await p.locator('#poolStatus').textContent();
    await p.evaluate(() => window.__poolTestWorkers[0].onmessage({data:{result:{solutions:[],truncated:false}}}));
    assert.equal(await p.locator('#poolStatus').textContent(), cancelledStatus, 'A late reply cannot resurrect a cancelled search');
    await p.locator('#poolSearchBtn').click();
    await entries.first().locator('.pool-name').fill('修改後仍須保留');
    await assertStale();
    assert(await p.evaluate(() => window.__poolTestWorkers[1].terminated));
    await p.evaluate(() => window.__poolTestWorkers[1].onmessage({data:{result:{solutions:[],truncated:false}}}));
    await assertStale();
    await p.locator('#poolSearchBtn').click();
    await p.evaluate(() => window.__poolTestWorkers[2].onerror({preventDefault(){}}));
    await settle();
    assert.equal(await p.locator('#poolStatus').getAttribute('data-state'), 'error');
    assert.deepEqual(await snapshot(), [{name:'修改後仍須保留',value:'5'}]);
    await p.evaluate(() => {window.Worker=window.__poolRealWorker;delete window.__poolRealWorker;delete window.__poolTestWorkers;});
    await successfulSearch();
    assert.deepEqual(compact(await equations(p.locator('#poolResults'))), ['5=5'], 'Real Worker still works after cancellation and error recovery');
    assert.equal(await p.locator('#calcExpression').textContent(), initialCalculator.expression, 'Pool edits must not trigger keypad shortcuts');
    assert.equal(await p.locator('#calcResult').textContent(), initialCalculator.result);
  } finally {
    await p.evaluate(() => {if(window.__poolRealWorker){window.Worker=window.__poolRealWorker;delete window.__poolRealWorker;delete window.__poolTestWorkers;}});
    await p.setViewportSize(initialViewport);
    await p.locator('.mode-switch [data-panel="generalPanel"]').click();
  }
};
