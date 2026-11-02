'use strict';
// Imported by browser-smoke.cjs after Playwright is installed. Synthetic dates only.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

module.exports = async function calculatorDateTools(p) {
  const previousViewport = p.viewportSize(), output = path.resolve(__dirname,'..','test-results','browser');
  fs.mkdirSync(output,{recursive:true});
  const initialCalculator = {expression:await p.locator('#calcExpression').textContent(),result:await p.locator('#calcResult').textContent()};
  const result = p.locator('#dateDiffResult'), shiftResult = p.locator('#dateShiftResult');
  const capture = name => p.screenshot({path:path.join(output,'accounting-calculator-dates-'+name+'.png'),fullPage:false,animations:'disabled'});
  async function diff(start,end,{mode='calendar',includeStart=false}={}) {
    await p.locator('#dateDiffStart').fill(start);await p.locator('#dateDiffEnd').fill(end);
    await p.locator('#dateDiffMode').selectOption(mode);await p.locator('#dateDiffIncludeStart').setChecked(includeStart);
    await p.locator('#dateDiffBtn').click();
  }
  async function offset(start,amount,mode='calendar') {
    await p.locator('#dateShiftStart').fill(start);await p.locator('#dateShiftAmount').fill(String(amount));
    await p.locator('#dateShiftMode').selectOption(mode);await p.locator('#dateShiftBtn').click();
  }
  async function expectDifference(expected) {
    assert.equal(await result.getAttribute('data-state'),'success',await result.textContent());
    assert.equal(await result.locator('.date-result-number').evaluate(e=>e.firstChild.textContent),expected);
  }
  async function expectDate(expected) {
    assert.equal(await shiftResult.getAttribute('data-state'),'success',await shiftResult.textContent());
    assert.equal(await shiftResult.locator('.date-result-date').textContent(),expected);
  }
  try {
    await p.locator('[data-panel="datePanel"]').click();assert(await p.locator('#datePanel').isVisible());
    assert.equal(await p.locator('[data-panel="datePanel"]').getAttribute('aria-pressed'),'true');
    const today = await p.evaluate(()=>{const now=new Date();return now.getFullYear().toString().padStart(4,'0')+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');});
    for(const id of ['dateDiffStart','dateDiffEnd','dateShiftStart'])assert.equal(await p.locator('#'+id).inputValue(),today);
    assert.match(await p.locator('.date-rule-notice').textContent(),/週六.*週日.*國定假日.*補班/);

    await diff('2024-02-28','2024-03-01');await expectDifference('2');
    await p.locator('#dateDiffIncludeStart').check();
    assert.equal(await result.getAttribute('data-state'),'stale');assert.equal(await result.locator('.date-result-number').count(),0,'Old result must disappear when counting rules change');
    await p.locator('#dateDiffBtn').click();await expectDifference('3');
    await diff('2024-03-01','2024-02-28');await expectDifference('−2');assert.match(await result.textContent(),/倒算/);
    await diff('2024-03-01','2024-03-01');await expectDifference('0');
    await diff('2024-03-01','2024-03-01',{includeStart:true});await expectDifference('1');
    await diff('2024-09-06','2024-09-09',{mode:'business'});await expectDifference('1');assert.match(await result.textContent(),/略過 2 個週末日/);
    await diff('2024-09-06','2024-09-09',{mode:'business',includeStart:true});await expectDifference('2');
    await diff('2024-09-07','2024-09-09',{mode:'business',includeStart:true});await expectDifference('1');
    await diff('2024-09-09','2024-09-07',{mode:'business'});await expectDifference('0');
    await diff('2024-09-09','2024-09-07',{mode:'business',includeStart:true});await expectDifference('−1');
    await diff('2024-09-07','2024-09-07',{mode:'business',includeStart:true});await expectDifference('0');assert.match(await result.textContent(),/起日是週末/);
    await diff('2024-03-09','2024-03-11');await expectDifference('2');
    await diff('2024-11-02','2024-11-04');await expectDifference('2');
    await p.locator('#dateDiffEnd').fill('');await p.locator('#dateDiffBtn').click();
    assert.equal(await result.getAttribute('data-state'),'error');assert.match(await result.textContent(),/結束日期/);assert.equal(await result.locator('.date-result-number').count(),0);

    await offset('2024-12-31',1);await expectDate('2025-01-01');assert.match(await shiftResult.textContent(),/星期三/);
    await offset('2024-03-01',-1);await expectDate('2024-02-29');
    await offset('2024-09-06',1,'business');await expectDate('2024-09-09');
    await offset('2024-09-09',-1,'business');await expectDate('2024-09-06');
    await offset('2024-09-07',5,'business');await expectDate('2024-09-13');assert.match(await shiftResult.textContent(),/實際跨越 6 個日曆天.*略過 1 個週末日/);
    await offset('2024-09-08',-5,'business');await expectDate('2024-09-02');
    await offset('2024-09-07',0,'business');await expectDate('2024-09-07');assert.match(await shiftResult.textContent(),/保留原日期/);
    await offset('0050-12-31',1);await expectDate('0051-01-01');
    await p.locator('#dateShiftAmount').fill('3.5');
    assert.equal(await shiftResult.getAttribute('data-state'),'stale');assert.equal(await shiftResult.locator('.date-result-date').count(),0);
    await p.locator('#dateShiftBtn').click();assert.equal(await shiftResult.getAttribute('data-state'),'error');assert.match(await shiftResult.textContent(),/整數/);
    await offset('2024-09-01','');assert.equal(await shiftResult.getAttribute('data-state'),'error');assert.match(await shiftResult.textContent(),/填入.*天數/);
    await offset('2024-09-01',100001);assert.equal(await shiftResult.getAttribute('data-state'),'error');assert.match(await shiftResult.textContent(),/100,000/);
    await offset('9999-12-31',1);assert.equal(await shiftResult.getAttribute('data-state'),'error');assert.match(await shiftResult.textContent(),/超出/);
    await offset('0001-01-01',-1,'business');assert.equal(await shiftResult.getAttribute('data-state'),'error');assert.match(await shiftResult.textContent(),/超出/);
    await offset('2000-01-01',100000,'business');await expectDate('2383-04-22');

    await diff('2024-09-06','2024-09-09',{mode:'business'});await offset('2024-09-07',5,'business');
    await p.evaluate(()=>scrollTo(0,0));await capture('desktop');
    for(const width of [390,320]) {
      await p.setViewportSize({width,height:844});
      await p.locator('[data-panel="datePanel"]').click();
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Date tools must not widen the page at '+width+'px');
      for(const selector of ['#dateDiffStart','#dateDiffEnd','#dateShiftStart','#dateShiftAmount','.date-result-date']) {
        assert(await p.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}),selector+' clipped at '+width+'px');
      }
      for(const selector of ['.date-help','.date-result-detail','.date-rule-notice']) {
        const sizes=await p.locator(selector).evaluateAll(nodes=>nodes.map(node=>parseFloat(getComputedStyle(node).fontSize)));
        assert(sizes.every(size=>size>=14),'Date explanations should remain body-sized');
      }
      await p.locator('#dateShiftResult').scrollIntoViewIfNeeded();await capture('mobile-'+width);
    }
    await p.emulateMedia({reducedMotion:'reduce'});await offset('2024-01-01',30);
    assert.equal(await shiftResult.evaluate(e=>getComputedStyle(e).animationName),'none');
    await p.emulateMedia({reducedMotion:'no-preference'});

    // Freeze an instant whose UTC date differs from the selected browser-local day.
    const url=p.url(),origin=new URL(url).origin;
    for(const [timezoneId,instant,expected] of [['Pacific/Kiritimati','2024-03-10T23:30:00Z','2024-03-11'],['America/Los_Angeles','2024-03-10T01:30:00Z','2024-03-09']]) {
      const context=await p.context().browser().newContext({timezoneId,serviceWorkers:'block'}),errors=[],external=[];
      try {
        await context.route(/^https?:/i,route=>{if(origin!=='null'&&new URL(route.request().url()).origin===origin)return route.continue();external.push(route.request().url());return route.abort('blockedbyclient');});
        await context.addInitScript(iso=>{const OriginalDate=Date,frozen=OriginalDate.parse(iso);globalThis.Date=class extends OriginalDate {constructor(...args){super(...(args.length?args:[frozen]));}static now(){return frozen;}};},instant);
        const local=await context.newPage();local.on('pageerror',error=>errors.push(error.message));await local.goto(url);
        assert.equal(await local.locator('#dateDiffStart').inputValue(),expected,'Default date must use '+timezoneId+' local calendar day');
        await local.locator('[data-panel="datePanel"]').click();await local.locator('#dateDiffStart').fill('2024-03-09');await local.locator('#dateDiffEnd').fill('2024-03-11');await local.locator('#dateDiffBtn').click();
        assert.equal(await local.locator('#dateDiffResult .date-result-number').evaluate(e=>e.firstChild.textContent),'2','Date-only calculation must ignore DST');
        assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
      } finally {await context.close();}
    }
    assert.equal(await p.locator('#calcExpression').textContent(),initialCalculator.expression,'Date entry must not reach calculator keyboard shortcuts');
    assert.equal(await p.locator('#calcResult').textContent(),initialCalculator.result);
  } finally {
    await p.setViewportSize(previousViewport);
    await p.emulateMedia({reducedMotion:'no-preference'});
    await p.locator('[data-panel="generalPanel"]').click();
  }
};
