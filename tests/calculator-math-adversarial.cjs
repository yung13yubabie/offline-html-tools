'use strict';
// Synthetic-only deterministic adversarial tests; Node built-ins, no browser/network.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../apps/accounting-calculator.html'),'utf8');
const start=html.indexOf('const CalculatorMathTools ='),end=html.indexOf('/* CALCULATOR_MATH_TOOLS_END */');
assert(start>=0&&end>start,'Math API markers must exist');
const api=vm.runInNewContext(html.slice(start,end)+';CalculatorMathTools;');
let checks=0,seed=15439;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;}
function knownSystems(count,scaled){let checked=0;for(let k=0;k<count;k++){
 const x=Math.floor(rand()*21)-10,y=Math.floor(rand()*21)-10,a=Math.floor(rand()*21)-10,b=Math.floor(rand()*21)-10,c=Math.floor(rand()*21)-10,d=Math.floor(rand()*21)-10;
 if(a*d===b*c)continue;
 const e=scaled?Math.floor(rand()*121)-60:0,f=scaled?Math.floor(rand()*121)-60:0;
 const source=`${a}e${e}x+${b}e${e}y=${a*x+b*y}e${e}\n${c}e${f}x+${d}e${f}y=${c*x+d*y}e${f}`;
 // No exception is expected for these bounded, well-conditioned systems.
 const r=api.solveLinear(source);
 assert.equal(r.status,'unique',source);
 assert(Math.abs(r.values[0]-x)<1e-8&&Math.abs(r.values[1]-y)<1e-8,source+' returned '+JSON.stringify(r));
 checked++;checks++;
 }return checked;}
assert.equal(knownSystems(1000,false),976);
assert.equal(knownSystems(500,true),486);
const precisionErrors=new Set([
 '數值差距過大，無法保留計算精度；請調整單位後再試。',
 '數值差距過大，無法保留加減精度；請調整單位後再試。',
 '數值過小，請調整單位後再試。'
]);
function safe(label,run,accept){let result,validationRejected=false;
 try{result=run();}catch(error){
  // vm errors belong to another realm: validate name and exact known message.
  // TypeError/ReferenceError and unrelated exceptions must never count as safety.
  const message=typeof error?.message==='string'?error.message.replace(/^第 \d+ 行：/,''):'';
  if(error?.name!=='Error'||!precisionErrors.has(message))throw error;
  validationRejected=true;
 }
 // Assertions deliberately run outside catch, so semantic failures cannot pass.
 if(!validationRejected)assert(accept(result),label+': '+JSON.stringify(result));
 checks++;
}
for(const mode of ['forward','reverse'])safe('ratio '+mode+' division underflow',()=>api.ratio(mode,'1e100','1e100','1e-300'),r=>r.value===1e-300);
safe('rank lost to division underflow',()=>api.solveLinear('1e100x+1e-300y=0\nx=0'),r=>r.status==='uncertain'||r.status==='unique'&&r.values.every(v=>v===0));
safe('unrepresentable nonzero solution',()=>api.solveLinear('1e100x=1e-300'),r=>r.status==='uncertain');
safe('parser swallowed addend',()=>api.solveLinear('x+1e20=1e20+1'),r=>r.status==='uncertain'||r.status==='unique'&&r.values[0]===1);
safe('near contradictory redundancy',()=>api.solveLinear('x=1\nx=1.000000000000001'),r=>['uncertain','inconsistent'].includes(r.status));
console.log(`PASS ${checks} adversarial math checks (1462 known systems + 6 precision-safety cases)`);
