'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const {DateToolsEngine:E,createDateToolsEngine} = require('../calculator/date-tools.js');
let checks = 0;
function check(name,run) {run();checks++;console.log('PASS '+name);}
const difference = (start,end,mode='calendar',includeStart=false) => E.difference({start,end,mode,includeStart});
const shift = (start,amount,mode='calendar') => E.shift({start,amount,mode});
function oracleDay(text) {
  const [year,month,day] = text.split('-').map(Number), y=year-1;
  const leap = year%4===0 && (year%100!==0 || year%400===0);
  const cumulative=[0,31,59,90,120,151,181,212,243,273,304,334];
  return 365*y+Math.floor(y/4)-Math.floor(y/100)+Math.floor(y/400)+cumulative[month-1]+(leap&&month>2?1:0)+day-1-719162;
}
function oracleBusinessDifference(start,end,includeStart) {
  const direction=end<start?-1:1;let count=0;
  for(let day=start+(includeStart?0:direction); direction>0?day<=end:day>=end; day+=direction) {
    const week=new Date(day*86400000).getUTCDay();if(week!==0&&week!==6)count++;
  }
  return count?count*direction:0;
}
function oracleShift(start,amount) {
  const direction=amount<0?-1:1;let day=start,count=0;
  while(count<Math.abs(amount)) {day+=direction;const week=new Date(day*86400000).getUTCDay();if(week!==0&&week!==6)count++;}
  return day;
}
check('strict Gregorian parsing, early years and round trips',()=>{
  for(const value of ['0001-01-01','0004-02-29','0050-09-12','0099-12-31','0100-03-01','0400-02-29','1900-03-01','1970-01-01','2000-02-29','2024-02-29','9999-12-31']) {
    assert.equal(E.parseDate(value),oracleDay(value),value);assert.equal(E.formatDate(E.parseDate(value)),value);
  }
  assert.equal(E.parseDate(' 2024-03-01 '),oracleDay('2024-03-01'));
  for(const value of ['',null,123,'2024-2-01','2024/02/01','2024-01-01T00:00:00Z','0000-01-01','10000-01-01','2024-00-10','2024-13-01','2024-01-00','2024-01-32','2023-02-29','1900-02-29','2100-02-29'])assert.throws(()=>E.parseDate(value),undefined,String(value));
});
check('calendar differences, inclusivity, reverse direction and leap boundaries',()=>{
  assert.equal(difference('2024-02-28','2024-03-01').days,2);
  assert.equal(difference('2023-02-28','2023-03-01').days,1);
  assert.equal(difference('2024-12-31','2025-01-01').days,1);
  assert.equal(difference('2025-01-01','2024-12-31').days,-1);
  assert.equal(difference('2025-01-01','2024-12-31','calendar',true).days,-2);
  assert.equal(difference('2024-03-01','2024-03-01').days,0);
  assert.equal(difference('2024-03-01','2024-03-01','calendar',true).days,1);
  assert.equal(difference('0001-01-01','9999-12-31').days,3652058);
  assert.equal(difference('9999-12-31','0001-01-01','calendar',true).days,-3652059);
});
check('business differences exclude the selected start, include eligible end, and skip weekends',()=>{
  assert.equal(difference('2024-09-06','2024-09-09','business').days,1);
  assert.equal(difference('2024-09-06','2024-09-09','business',true).days,2);
  assert.equal(difference('2024-09-07','2024-09-09','business').days,1);
  assert.equal(difference('2024-09-07','2024-09-09','business',true).days,1);
  assert.equal(difference('2024-09-09','2024-09-07','business').days,0);
  assert.equal(difference('2024-09-09','2024-09-07','business',true).days,-1);
  assert.equal(difference('2024-09-09','2024-09-06','business').days,-1);
  assert.equal(difference('2024-09-09','2024-09-06','business',true).days,-2);
  assert.equal(difference('2024-09-07','2024-09-07','business',true).days,0);
  assert.equal(difference('2024-09-09','2024-09-09','business',true).days,1);
  const result=difference('2024-09-07','2024-09-09','business',true);
  assert.equal(result.calendarDays,3);assert.equal(result.excludedWeekendDays,2);
  // Weekday public holidays are ordinary weekdays in this explicitly weekend-only mode.
  assert.equal(difference('2024-12-24','2024-12-25','business').days,1);
});
check('calendar offset accepts signed integers and crosses month/year/leap boundaries',()=>{
  for(const [start,amount,expected] of [['2024-02-28',1,'2024-02-29'],['2024-03-01',-1,'2024-02-29'],['2023-03-01',-1,'2023-02-28'],['2024-12-31',1,'2025-01-01'],['0050-12-31','+1','0051-01-01'],['2024-09-07',0,'2024-09-07']])assert.equal(shift(start,amount).date,expected);
  for(const [value,expected] of [['+30',30],['-7',-7],['0',0],['-0',0],[' 100000 ',100000],[-100000,-100000]])assert.equal(E.parseOffset(value),expected);
  for(const value of ['',null,'3.5','1e2','1,000','--3',Infinity,100001,-100001,{},'12345678901234567890'])assert.throws(()=>E.parseOffset(value));
});
check('business offsets handle weekday/weekend starts, both directions and zero',()=>{
  for(const [start,amount,expected] of [['2024-09-06',1,'2024-09-09'],['2024-09-09',-1,'2024-09-06'],['2024-09-07',1,'2024-09-09'],['2024-09-07',-1,'2024-09-06'],['2024-09-08',1,'2024-09-09'],['2024-09-08',-1,'2024-09-06'],['2024-09-07',5,'2024-09-13'],['2024-09-07',-5,'2024-09-02'],['2024-09-08',5,'2024-09-13'],['2024-09-08',-5,'2024-09-02'],['2024-09-07',0,'2024-09-07'],['2024-09-08',0,'2024-09-08']])assert.equal(shift(start,amount,'business').date,expected,start+' '+amount);
  const result=shift('2024-09-07',5,'business');assert.equal(result.calendarDays,6);assert.equal(result.excludedWeekendDays,1);assert.equal(result.weekday,5);
});
check('result limits, invalid modes and field-specific errors are explicit',()=>{
  assert.throws(()=>shift('0001-01-01',-1),/範圍/);assert.throws(()=>shift('9999-12-31',1),/範圍/);
  assert.throws(()=>shift('0001-01-01',-1,'business'),/範圍/);assert.throws(()=>shift('9999-12-31',1,'business'),/範圍/);
  assert.equal(shift('0001-01-01',0).date,'0001-01-01');assert.equal(shift('9999-12-31',0,'business').date,'9999-12-31');
  assert.throws(()=>difference('', '2024-01-01'),/起始日期/);assert.throws(()=>difference('2024-01-01',''),/結束日期/);
  assert.throws(()=>difference('2024-01-01','2024-01-02','oops'),/計算方式|請選擇/);
  assert.throws(()=>E.difference({start:'2024-01-01',end:'2024-01-02',includeStart:'false'}),/勾選/);
  assert.throws(()=>E.formatDate(E.MAX_DAY+1),/範圍/);assert.throws(()=>E.weekday(1.1),/範圍/);
});
check('400 random date ranges and offsets match independent day-by-day oracles',()=>{
  let seed=2441928;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(let trial=0;trial<400;trial++) {
    const first=oracleDay('1800-01-01')+random()%146000,delta=(random()%801)-400,last=first+delta;
    const start=E.formatDate(first),end=E.formatDate(last),includeStart=!!(trial%2),offset=(random()%401)-200;
    const actual=difference(start,end,'business',includeStart),expected=oracleBusinessDifference(first,last,includeStart);
    assert.equal(actual.days,expected,start+' '+end+' '+includeStart);assert.equal(actual.excludedWeekendDays,Math.abs(actual.calendarDays)-Math.abs(expected));
    assert.equal(E.parseDate(shift(start,offset,'business').date),oracleShift(first,offset));
    assert.equal(E.parseDate(shift(start,offset).date),first+offset);
  }
});
check('large allowed offsets use batching without changing weekday counts',()=>{
  for(const amount of [-100000,100000]) {
    const first=oracleDay('2000-01-01');assert.equal(E.parseDate(shift('2000-01-01',amount,'business').date),oracleShift(first,amount));
    assert.equal(E.parseDate(shift('2000-01-01',amount).date),first+amount);
  }
});
check('date arithmetic is invariant across DST and host time zones',()=>{
  const modulePath=path.resolve(__dirname,'../calculator/date-tools.js');
  const script=`const E=require(${JSON.stringify(modulePath)}).DateToolsEngine; console.log(JSON.stringify([E.difference({start:'2024-03-09',end:'2024-03-11'}),E.difference({start:'2024-11-02',end:'2024-11-04'}),E.shift({start:'2024-03-08',amount:1,mode:'business'}),E.shift({start:'0050-01-01',amount:1})]));`;
  const outputs=['UTC','America/New_York','Pacific/Kiritimati','Asia/Taipei'].map(TZ=>{const r=spawnSync(process.execPath,['-e',script],{env:{...process.env,TZ},encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;});
  for(const result of outputs)assert.equal(result,outputs[0]);
});
check('factory has no captured module state and UI uses safe DOM rendering',()=>{
  const isolated=vm.runInNewContext('('+createDateToolsEngine.toString()+')()');assert.equal(isolated.shift({start:'0099-12-31',amount:1}).date,'0100-01-01');
  const ui=fs.readFileSync(path.resolve(__dirname,'../calculator/date-tools-ui.js'),'utf8');new vm.Script(ui);
  assert(!/innerHTML|outerHTML|insertAdjacentHTML|\beval\s*\(|\bfetch\s*\(/.test(ui));assert(ui.includes('now.getFullYear()'));assert(!ui.includes('toISOString'));
  const markup=fs.readFileSync(path.resolve(__dirname,'../calculator/date-tools.html'),'utf8');assert(markup.includes('role="status"'));assert(markup.includes('未扣除國定假日'));assert(!/<(?:script|link)[^>]+(?:src|href)=/.test(markup));
});
console.log(`RESULT ${checks} date-tool checks passed, including 400 independent date/offset oracle comparisons`);
