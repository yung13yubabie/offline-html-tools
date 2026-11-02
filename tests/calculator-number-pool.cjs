'use strict';
const assert=require('node:assert/strict');
const {NumberPoolEngine:E,createNumberPoolEngine}=require('../calculator/number-pool.js');
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS',name);}
const items=values=>values.map((value,i)=>({id:'row-'+i,name:'合成名稱 '+i,value:E.parseNumber(String(value))}));
function oracle(rows,target,mode,tolerance,limit){
 const all=[],signs=[],base=mode==='add'?2:3;
 function visit(i,total,positives){
  if(i===rows.length){
   if(!signs.some(Boolean)||(mode==='subtract'&&positives!==1)||Math.abs(total-target)>tolerance)return;
   const terms=signs.flatMap((sign,index)=>sign?[{index,sign}]:[]);
   const code=signs.reduce((v,sign,index)=>v+(sign===-1?2:sign)*base**index,0);
   all.push({terms,total,difference:total-target,code});return;
  }
  for(const sign of mode==='add'?[0,1]:[0,1,-1]){
   if(mode==='subtract'&&sign===1&&positives===1)continue;
   signs[i]=sign;visit(i+1,total+rows[i].value*sign,positives+(sign===1));
  }
 }
 visit(0,0,0);all.sort((a,b)=>Math.abs(a.difference)-Math.abs(b.difference)||a.terms.length-b.terms.length||a.code-b.code);
 return {solutions:all.slice(0,limit).map(({code,...row})=>row),truncated:all.length>limit,count:all.length};
}
check('decimal parsing stays exact and format roundtrips',()=>{
 for(const [text,value]of [['0',0],['-0',0],['0.1',1000],['.0001',1],['-0.0001',-1],['1,234.5678',12345678],[' +１２３.４ ',1234000],['−20.5',-205000],['1000000000',10000000000000]]){
  assert.equal(E.parseNumber(text),value);assert.equal(E.parseNumber(E.format(value)),value);
 }
 assert.equal(E.parseNumber('0.1')+E.parseNumber('0.2'),E.parseNumber('0.3'));
 assert.equal(E.format(1234567890123),'123,456,789.0123');
});
check('reject blank, malformed grouping, scientific notation, precision loss and out-of-range values',()=>{
 for(const value of ['', '1,23','12,345,67','1e3','Infinity','NaN','1.23456','-0.00001','1000000000.0001','0x10','5%'])assert.throws(()=>E.parseNumber(value));
 assert.throws(()=>E.format(NaN));
});
check('custom delimiters preserve original labels and duplicate source rows',()=>{
 const r=E.parseLines(' 公司甲  ｜1,200.5\n公司甲｜1,200.5\n42\n\n<img src=x>｜-12.3','｜');
 assert.deepEqual(r.errors,[]);assert.equal(r.items.length,4);assert.equal(r.items[0].name,' 公司甲  ');assert.equal(r.items[1].name,'公司甲');assert.equal(r.items[2].name,'');assert.equal(r.items[3].name,'<img src=x>');assert.equal(r.items[3].line,5);assert.notEqual(r.items[0].id,r.items[1].id);
 assert.equal(r.items[0].value,E.parseNumber('1200.5'));
});
check('delimiter inside names, comma thousands, negative delimiter and tabs are unambiguous',()=>{
 for(const [text,delimiter,name,value] of [['部門|項目|12','|','部門|項目',12],['Food, office, 1,200.5',',','Food, office',1200.5],['借款--500','-','借款',-500],['Name\t12','\\t','Name',12],['A B 1,200',' ','A B',1200]]){
  const r=E.parseLines(text,delimiter);assert.deepEqual(r.errors,[]);assert.equal(r.items[0].name,name);assert.equal(r.items[0].value,E.parseNumber(value));
 }
});
check('invalid rows report exact original line and are never coerced to zero',()=>{
 const r=E.parseLines('10\n\n名稱｜錯誤\n名稱｜0.00001\n名稱｜','｜');assert.equal(r.items.length,1);assert.deepEqual(r.errors.map(e=>e.line),[3,4,5]);assert(r.errors.every(e=>e.message));
 assert(E.parseLines('Name 20','').errors.length);assert(E.parseLines('x','\n').errors.length);assert(E.parseLines('x'.repeat(200001),'|').errors.length);assert(E.parseLines('\n'.repeat(1001),'').errors.length);
});
check('exact addition retains individual repeated-row identities',()=>{
 const rows=items([10,10,20]),r=E.solve({items:rows,target:E.parseNumber(20),mode:'add',tolerance:0});
 assert.deepEqual(r.solutions.map(s=>s.terms),[[{index:2,sign:1}],[{index:0,sign:1},{index:1,sign:1}]]);assert.equal(r.complete,true);
});
check('subtraction uses one positive anchor and mixed mode may have several positives',()=>{
 const rows=items([8,5,2]);
 const sub=E.solve({items:rows,target:E.parseNumber(1),mode:'subtract',tolerance:0});assert(sub.solutions.some(s=>s.terms.length===3));assert(sub.solutions.every(s=>s.terms.filter(t=>t.sign===1).length===1));
 const mixed=E.solve({items:rows,target:E.parseNumber(11),mode:'mixed',tolerance:0});assert(mixed.solutions.some(s=>s.terms.map(t=>t.sign).join(',')==='1,1,-1'));
});
check('signed distance, exact decimal totals and empty pool semantics',()=>{
 const rows=items([0.1,0.2,0.4]);const r=E.solve({items:rows,target:E.parseNumber(0.3),mode:'add',tolerance:E.parseNumber(0.1)});
 assert.equal(r.solutions[0].difference,0);assert.equal(r.solutions[0].total,3000);assert(r.solutions.some(s=>s.difference===-1000));assert(r.solutions.some(s=>s.difference===1000));
 assert.throws(()=>E.solve({items:[],target:0}));
 const z=E.solve({items:items([0]),target:0,tolerance:0});assert.equal(z.solutions.length,1);assert.equal(z.solutions[0].terms.length,1);
});
check('hard input and result bounds provide explicit errors',()=>{
 for(const [mode,max] of Object.entries(E.limits))assert.throws(()=>E.solve({items:items(Array(max+1).fill(1)),target:1,mode}));
 for(const options of [{mode:'unknown'},{mode:'toString'},{target:0.5},{tolerance:-1},{tolerance:NaN},{limit:0},{limit:1001},{effort:'unlimited'},{items:[{value:0.1}]}])assert.throws(()=>E.solve({items:items([1]),target:0,...options}));
});
let seed=27031;
function next(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;}
check('180 randomized small pools match an independent exhaustive oracle in all three modes',()=>{
 for(let sample=0;sample<60;sample++){
  const size=1+next()%7,rows=items(Array.from({length:size},()=>((next()%101)-50)/10));
  const target=E.parseNumber(((next()%101)-50)/10),tolerance=sample%3?E.parseNumber((next()%30)/10):Infinity,limit=1+next()%20;
  for(const mode of ['add','subtract','mixed']){
   const actual=E.solve({items:rows,target,tolerance,mode,limit}),expected=oracle(rows,target,mode,tolerance,limit);
   assert.deepEqual(actual.solutions,expected.solutions,`${sample} ${mode}`);assert.equal(actual.truncated,expected.truncated);assert.equal(actual.complete,!expected.truncated);assert.equal(actual.totalMatches,expected.truncated?null:expected.count);
  }
 }
});
check('all zero ties keep true fewest-terms order, even when results truncate',()=>{
 for(const mode of ['add','subtract','mixed']){
  const rows=items([0,0,0,0,0,0]),target=0,limit=11;
  const a=E.solve({items:rows,target,tolerance:0,mode,limit}),b=oracle(rows,target,mode,0,limit);
  assert.deepEqual(a.solutions,b.solutions);assert.equal(a.truncated,true);
 }
});
check('complete means all matches, not just an exact result count at the display boundary',()=>{
 const r=E.solve({items:items([1,2]),target:30000,tolerance:0,limit:1});assert.equal(r.truncated,false);assert.equal(r.totalMatches,1);
 const none=E.solve({items:items([1,2]),target:45000,tolerance:0});assert.equal(none.complete,true);assert.deepEqual(none.solutions,[]);
});
check('factory is standalone for a worker and shares no captured module state',()=>{
 const vm=require('node:vm'),factory=vm.runInNewContext('('+createNumberPoolEngine.toString()+')');const independent=factory();
 assert.equal(independent.parseNumber('12.3456'),123456);assert.equal(independent.solve({items:[{value:1}],target:1,tolerance:0}).solutions[0].difference,0);
});
check('exact thresholds retain original globally ranked output',()=>{
 for(const [mode,max] of Object.entries(E.exactLimits)){
  const rows=items(Array.from({length:max},(_,i)=>i+1));const result=E.solve({items:rows,target:E.parseNumber(20),mode,tolerance:E.parseNumber(1),limit:5});
  assert.equal(result.strategy,'exact');assert(result.searchComplete);assert(result.rankingGuaranteed);
  assert.equal(result.solutions.length,5);assert(result.truncated);assert.equal(result.solutions[0].difference,0);assert.equal(result.solutions[0].terms.length,1);
  for(const s of result.solutions){assert.equal(s.total,s.terms.reduce((sum,t)=>sum+rows[t.index].value*t.sign,0));assert.equal(new Set(s.terms.map(t=>t.index)).size,s.terms.length);}
 }
});
function validateLarge(result, rows, target, mode, tolerance) {
 assert.equal(result.strategy,'bounded');assert.equal(result.searchComplete,false);assert.equal(result.rankingGuaranteed,false);
 assert.equal(result.complete,false);assert.equal(result.totalMatches,null);assert.equal(result.poolSize,100);
 assert(Number.isFinite(result.elapsedMs)&&result.elapsedMs>=0);assert(result.examined<=2200010);
 assert(['bounded-search','state-budget','time-budget'].includes(result.stopReason));
 const identities=new Set();
 for(const solution of result.solutions){
  assert(solution.terms.length>0);const seen=new Set();
  for(const term of solution.terms){assert(Number.isInteger(term.index)&&term.index>=0&&term.index<rows.length);assert([1,-1].includes(term.sign));assert(!seen.has(term.index));seen.add(term.index);}
  if(mode==='add')assert(solution.terms.every(term=>term.sign===1));
  if(mode==='subtract')assert.equal(solution.terms.filter(term=>term.sign===1).length,1);
  assert.equal(solution.total,solution.terms.reduce((sum,term)=>sum+rows[term.index].value*term.sign,0));
  assert(Number.isSafeInteger(solution.total));assert.equal(solution.difference,solution.total-target);assert(Math.abs(solution.difference)<=tolerance);
  const key=solution.terms.map(term=>term.index+':'+term.sign).join(',');assert(!identities.has(key));identities.add(key);
 }
 for(let i=1;i<result.solutions.length;i++){
  const previous=result.solutions[i-1],current=result.solutions[i];
  assert(Math.abs(previous.difference)<=Math.abs(current.difference));
  if(Math.abs(previous.difference)===Math.abs(current.difference))assert(previous.terms.length<=current.terms.length);
 }
}
check('100-row support covers end-of-list singletons and pairs in all three modes',()=>{
 assert.deepEqual(E.limits,{add:100,subtract:100,mixed:100});
 const rows=items(Array.from({length:100},(_,i)=>i===99?667:i===98?333:10000+i));const before=JSON.stringify(rows);
 for(const mode of ['add','subtract','mixed']){
  const target=E.parseNumber(mode==='subtract'?-334:1000),result=E.solve({items:rows,target,mode,tolerance:0});
  validateLarge(result,rows,target,mode,0);
  assert(result.solutions.some(solution=>solution.terms.length===2&&solution.terms[0].index===98&&solution.terms[1].index===99));
  const single=E.solve({items:rows,target:E.parseNumber(667),mode,tolerance:0});
  assert(single.solutions.some(solution=>solution.terms.length===1&&solution.terms[0].index===99&&solution.terms[0].sign===1));
 }
 assert.equal(JSON.stringify(rows),before,'Searching must never modify names, values or source identity');
});
check('100-row search finds genuine three-term combinations beyond single/pair seeding',()=>{
 for(const mode of ['add','subtract','mixed']){
  const rows=items(Array(97).fill(10000).concat(mode==='subtract'?[100,31,59]:[311,337,352]));
  const target=E.parseNumber(mode==='subtract'?10:1000),result=E.solve({items:rows,target,mode,tolerance:0});
  validateLarge(result,rows,target,mode,0);
  assert(result.solutions.some(solution=>solution.terms.length===3&&solution.terms.map(term=>term.index).join(',')==='97,98,99'));
  assert(result.solutions.every(solution=>solution.terms.length>=3),'Fixture has no valid one/two-term result');
 }
});
check('partial no-result searches never claim a complete impossibility result',()=>{
 const rows=items(Array.from({length:100},(_,i)=>(i+1)*2));
 for(const mode of ['add','subtract','mixed']){
  const result=E.solve({items:rows,target:E.parseNumber(1),mode,tolerance:0});validateLarge(result,rows,E.parseNumber(1),mode,0);
  assert.deepEqual(result.solutions,[]);assert.equal(result.truncated,false);assert.equal(result.complete,false);assert.equal(result.totalMatches,null);
 }
});
check('large zeros and duplicate amounts keep distinct source terms and display truncation separate',()=>{
 const rows=items(Array(100).fill(0));
 for(const mode of ['add','subtract','mixed']){
  const result=E.solve({items:rows,target:0,mode,tolerance:0,limit:5});validateLarge(result,rows,0,mode,0);
  assert.equal(result.solutions.length,5);assert.equal(result.truncated,true);assert(result.solutions.every(solution=>solution.terms.length===1));
  assert(new Set(result.solutions.map(solution=>solution.terms[0].index)).size>=3);
 }
});
check('large signed four-decimal amounts and near matches retain exact arithmetic',()=>{
 const rows=items(Array(97).fill(10000).concat([-0.1,0.2,0.0001])),target=E.parseNumber(0.1001),tolerance=E.parseNumber(0.0001);
 for(const mode of ['add','subtract','mixed']){
  const result=E.solve({items:rows,target,mode,tolerance});validateLarge(result,rows,target,mode,tolerance);
  if(mode!=='subtract')assert(result.solutions.some(solution=>solution.total===1001&&solution.terms.length===3));
 }
});
check('large maximum magnitudes stay within safe integer totals',()=>{
 const rows=items(Array(100).fill(1000000000));
 const result=E.solve({items:rows,target:E.parseNumber(1000000000),mode:'mixed',tolerance:Infinity,limit:7});
 validateLarge(result,rows,E.parseNumber(1000000000),'mixed',Infinity);assert.equal(result.solutions.length,7);
});
check('standard/deep settings are reproducible on bounded fixtures and report effort',()=>{
 const rows=items(Array(97).fill(10000).concat([311,337,352])),target=E.parseNumber(1000);
 const standard=E.solve({items:rows,target,mode:'add',tolerance:0}),again=E.solve({items:rows,target,mode:'add',tolerance:0}),deep=E.solve({items:rows,target,mode:'add',tolerance:0,effort:'deep'});
 assert.deepEqual(standard.solutions,again.solutions);assert.equal(standard.effort,'standard');assert.equal(deep.effort,'deep');
 validateLarge(deep,rows,target,'add',0);assert(deep.solutions.some(solution=>solution.difference===0));
});
check('clock cutoff returns already-found seeds with explicit partial metadata',()=>{
 const vm=require('node:vm');let clock=0;
 const factory=vm.runInNewContext('('+createNumberPoolEngine.toString()+')',{Date:{now:()=>clock+=250}}),engine=factory();
 const rows=items(Array.from({length:100},(_,i)=>i===99?667:i===98?333:10000+i));
 const result=engine.solve({items:rows,target:E.parseNumber(1000),mode:'mixed',tolerance:0});
 assert.equal(result.stopReason,'time-budget');assert.equal(result.searchComplete,false);assert.equal(result.rankingGuaranteed,false);
 assert(result.solutions.some(solution=>solution.terms.length===2&&solution.terms[0].index===98&&solution.terms[1].index===99));
});
check('standalone download contains the current engine, UI, markup and styles',()=>{
 const {spawnSync}=require('node:child_process'),path=require('node:path');
 const result=spawnSync('python3',['tools/embed-calculator.py','--check'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout||String(result.error));
 assert.match(result.stdout,/sources match the standalone HTML/);
});
console.log(`RESULT ${checks} number-pool checks passed, including 180 independent exhaustive-oracle comparisons`);
