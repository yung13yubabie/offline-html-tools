'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {createMathFormEngine,MathFormEngine:F}=require('../calculator/math-form-core.js');
const html=fs.readFileSync(path.join(__dirname,'../apps/accounting-calculator.html'),'utf8');
const core='/* CALCULATOR_MATH_TOOLS_START:'+html.split('/* CALCULATOR_MATH_TOOLS_START:')[1].split('/* CALCULATOR_MATH_TOOLS_END */')[0];
const context=vm.createContext({});vm.runInContext(core+';globalThis.math=CalculatorMathTools',context);const M=context.math;
let checks=0;function test(name,fn){fn();checks++;console.log('PASS '+name);}
function row(values,constant){return {terms:values.map(value=>({sign:Number(value)<0?'-':'+',value:String(Math.abs(Number(value)))})),constant:String(constant)};}
function solve(rows,n){return M.solveLinear(F.buildLinear({variableCount:n,rows}).text);}
function values(result,expected){assert.equal(result.status,'unique');expected.forEach((value,i)=>assert(Math.abs(result.values[result.vars.indexOf(F.names[i])]-value)<1e-8));}
test('numeric fields normalize valid thousands without rounding decimal literals',()=>{
 assert.equal(F.numeric('  +1,234.500 '),'1234.500');assert.equal(F.numeric('−0.25'),'-0.25');assert.equal(F.numeric('1.000000000000001'),'1.000000000000001');assert.equal(F.numeric('1e-30'),'1e-30');assert.throws(()=>F.numeric(''));assert.equal(F.numeric('',{allowBlank:true}),'0');
});
test('strict input blocks expressions, percent suffixes, malformed grouping and overflow',()=>{
 for(const bad of ['NaN','Infinity','1/2','12%','<img>','1;alert(1)','1,23','1e999','1e-999','0x10','1'.repeat(121)])assert.throws(()=>F.numeric(bad),undefined,bad);
 assert.throws(()=>F.numeric('-2',{allowNegative:false}),/正負號/);
});
test('two- and three-variable forms feed the unchanged solver',()=>{
 values(solve([row([1,1],100),row([2,3],240)],2),[60,40]);
 values(solve([row([1,1,1],6),row([2,-1,1],3),row([1,2,-1],2)],3),[1,2,3]);
});
test('zeros and blank coefficients retain all declared unknowns',()=>{
 const r=F.buildLinear({variableCount:2,rows:[{terms:[{sign:'+',value:'1'},{sign:'-',value:''}],constant:'2'}]});
 assert.equal(r.text,'1*x - 0*y = 2');assert.equal(M.solveLinear(r.text).status,'infinite');
 assert.equal(solve([row([0,0],0)],2).status,'infinite');assert.equal(solve([row([0,0],1)],2).status,'inconsistent');
});
test('negative RHS, signs and decimals remain mathematically correct',()=>{
 const result=solve([row([2,-1],-4),row([1,1],1)],2);values(result,[-1,2]);
 const built=F.buildLinear({variableCount:1,rows:[{terms:[{sign:'-',value:'0.5'}],constant:'−1.5'}]});values(M.solveLinear(built.text),[3]);
});
test('field-specific errors and all shape bounds are explicit',()=>{
 for(const variableCount of [0,11,2.5,'2'])assert.throws(()=>F.buildLinear({variableCount,rows:[row([1],1)]}));
 assert.throws(()=>F.buildLinear({variableCount:1,rows:[]}));assert.throws(()=>F.buildLinear({variableCount:1,rows:Array(21).fill(row([1],1))}));
 assert.throws(()=>F.buildLinear({variableCount:2,rows:[row([1],1)]}),/第 1 條/);
 assert.throws(()=>F.buildLinear({variableCount:1,rows:[{terms:[{sign:'*',value:'1'}],constant:'2'}]}),/正負號/);
 assert.throws(()=>F.buildLinear({variableCount:1,rows:[{terms:[{sign:'+',value:'-2'}],constant:'2'}]}),/第 1 條 x/);
 assert.throws(()=>F.buildLinear({variableCount:1,rows:[{terms:[{sign:'+',value:'1'}],constant:''}]}),/等號右側/);
});
test('ten unknowns and twenty equations stay within the solver contract',()=>{
 const rows=Array.from({length:10},(_,i)=>row(Array.from({length:10},(_,j)=>i===j?1:0),i-4));values(solve([...rows,...rows],10),Array.from({length:10},(_,i)=>i-4));
 const long='0.'+'1'.repeat(110);assert.throws(()=>F.buildLinear({variableCount:10,rows:Array.from({length:20},()=>({terms:Array.from({length:10},()=>({sign:'+',value:long})),constant:'1'}))}),/6000/);
});
test('100 independently constructed systems roundtrip known solutions through the solver',()=>{
 let seed=1729;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};
 for(let iteration=0;iteration<100;iteration++){
  const n=1+random()%6,answer=Array.from({length:n},()=>random()%21-10),matrix=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?30:random()%7-3));
  const rows=matrix.map(coefficients=>row(coefficients,coefficients.reduce((sum,v,i)=>sum+v*answer[i],0)));values(solve(rows,n),answer);
 }
});
test('factory has no captured state and source cannot inject executable expressions',()=>{
 const isolated=vm.runInNewContext('('+createMathFormEngine.toString()+')()');assert.equal(isolated.numeric('1,000'),'1000');
 assert.throws(()=>F.buildLinear({variableCount:1,rows:[{terms:[{sign:'+',value:'1);globalThis.bad=1;('}],constant:'1'}]}));assert.equal(context.bad,undefined);
});
test('all calculator fragments match the standalone download',()=>{
 const r=spawnSync('python3',['tools/embed-calculator.py','--check'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);
});
console.log(`RESULT ${checks} guided-form checks passed, including 100 independent known-solution systems`);
