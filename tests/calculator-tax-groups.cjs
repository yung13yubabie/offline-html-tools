'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createTaxGroupsCore19}=require('../calculator/tax-groups-core.js');
const E=createTaxGroupsCore19();let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
function result(amount,mode='gross',precision='yuan',rate='5'){return E.calculate({amount,mode,precision,rate});}
function amounts(actual,net,tax,gross){assert.equal(actual.netCents,BigInt(net));assert.equal(actual.taxCents,BigInt(tax));assert.equal(actual.grossCents,BigInt(gross));assert.equal(actual.netCents+actual.taxCents,actual.grossCents);}
test('amount parser preserves cents, signs, valid separators and blank identity',()=>{
 for(const [raw,expected]of [['1,234.56',123456n],['  +.5 ',50n],['−１２３.４５',-12345n],['0',0n],['-0.00',0n],['5.',500n],['.01',1n],['999,999,999,999.99',99999999999999n]])assert.equal(E.parseAmount(raw),expected);
 for(const raw of ['',null,undefined,'  '])assert.equal(E.parseAmount(raw),null);
 for(const raw of ['1.001','1,00','1,234,56','1e2','0x10','NaN','Infinity','--1','1 + 2','1_000','2%','<img>','1000000000000.00',{},true])assert.throws(()=>E.parseAmount(raw),undefined,String(raw));
});
test('rate parsing is exact, bounded and separate from currency precision',()=>{
 for(const [raw,value]of [['0',0n],['5',50000n],['5.1234',51234n],['100',1000000n],['.0001',1n]])assert.equal(E.parseRate(raw),value);
 for(const raw of ['',null,'-1','100.0001','5.12345','5%','5e0','1,000','Infinity'])assert.throws(()=>E.parseRate(raw));
});
test('gross input is preserved while the chosen tax precision changes the split',()=>{
 amounts(result('105.50','gross','yuan'),10050,500,10550);
 amounts(result('105.50','gross','cent'),10048,502,10550);
 amounts(result('10.50','gross','yuan'),950,100,1050);
 amounts(result('10.50','gross','cent'),1000,50,1050);
});
test('net input is preserved and tax rounds symmetrically away from zero',()=>{
 amounts(result('10','net','yuan'),1000,100,1100);
 amounts(result('-10','net','yuan'),-1000,-100,-1100);
 amounts(result('0.10','net','cent'),10,1,11);
 amounts(result('-0.10','net','cent'),-10,-1,-11);
 amounts(result('-10.50','gross','yuan'),-950,-100,-1050);
 amounts(result('-105.50','gross','cent'),-10048,-502,-10550);
});
test('zero values and zero rates remain valid calculations, blanks do not',()=>{
 for(const mode of ['gross','net'])for(const precision of ['yuan','cent']){
  amounts(result('0',mode,precision),0,0,0);
  amounts(result('-123.45',mode,precision,'0'),-12345,0,-12345);
  assert.equal(result('',mode,precision),null);
 }
});
test('each row rounds first, then exact cents are summed',()=>{
 const data=E.summarize(['10','10','10'],{mode:'net',rate:'5',precision:'yuan'});
 assert.deepEqual(data.totals,{netCents:3000n,taxCents:300n,grossCents:3300n});
 assert.notEqual(data.totals.taxCents,result('30','net','yuan').taxCents,'Do not replace per-row rounding with total-rounding');
 const credits=E.summarize(['10','-10','.10','-.10'],{mode:'net',rate:'5',precision:'cent'});
 assert.deepEqual(credits.totals,{netCents:0n,taxCents:0n,grossCents:0n});
});
test('invalid rows are reported and excluded without coercing them into zero',()=>{
 const data=E.summarize(['105','','bad','-52.50','0','0.001'],{mode:'gross',rate:'5',precision:'cent'});
 assert.equal(data.validCount,3);assert.equal(data.blankCount,1);assert.equal(data.invalidCount,2);assert.equal(data.complete,false);
 assert.deepEqual(data.rows.map(row=>row.status),['valid','blank','error','valid','valid','error']);
 assert.deepEqual(data.totals,{netCents:5000n,taxCents:250n,grossCents:5250n});
 assert.match(data.rows[2].error,/金額/);assert.equal(data.rows[2].index,2);
 assert.throws(()=>E.summarize(['100'],{rate:'bad'}));
 assert.throws(()=>E.summarize(Array(1001).fill('1')));
});
test('maximum rows and amounts sum beyond Number safe integer without precision loss',()=>{
 const rows=Array(1000).fill('999,999,999,999.99'),data=E.summarize(rows,{mode:'net',rate:'100',precision:'cent'});
 assert.equal(data.totals.netCents,99999999999999000n);assert.equal(data.totals.taxCents,data.totals.netCents);assert.equal(data.totals.grossCents,199999999999998000n);
 assert.equal(E.format(data.totals.grossCents),'1,999,999,999,999,980.00');assert.equal(E.format(-1n),'−0.01');assert.equal(E.format(0n),'0.00');
});
test('boundary ratios match an independent quotient/remainder oracle',()=>{
 function oracle(n,d){let q=n/d,r=n%d;if(r<0n)r=-r;if(r*2n>=d)q+=n<0n?-1n:1n;return q;}
 for(const cents of [-10001n,-1050n,-1000n,-101n,-10n,-1n,0n,1n,10n,101n,1000n,1050n,10001n])for(const rate of ['0','.0001','5','7.25','99.9999','100'])for(const mode of ['net','gross'])for(const precision of ['yuan','cent']){
  const raw=(cents<0n?'-':'')+String((cents<0n?-cents:cents)/100n)+'.'+String((cents<0n?-cents:cents)%100n).padStart(2,'0');
  const r=E.parseRate(rate),unit=precision==='yuan'?100n:1n,den=(mode==='net'?1000000n:1000000n+r)*unit,expected=oracle(cents*r,den)*unit,actual=result(raw,mode,precision,rate);
  assert.equal(actual.taxCents,expected);assert.equal(actual.netCents+actual.taxCents,actual.grossCents);assert.equal(mode==='net'?actual.netCents:actual.grossCents,cents);
 }
});
test('invalid settings are explicit and the factory captures no outside state',()=>{
 for(const settings of [{mode:'other'},{precision:'other'},{rate:'NaN'}])assert.throws(()=>E.calculate({amount:'105',...settings}));
 const isolated=vm.runInNewContext('('+createTaxGroupsCore19.toString()+')()');assert.equal(isolated.calculate({amount:'105',mode:'gross',rate:'5',precision:'yuan'}).netCents,10000n);
 const ui=fs.readFileSync(path.join(__dirname,'../calculator/tax-groups-ui.js'),'utf8');new vm.Script(ui);assert(!/innerHTML|\beval\s*\(|new\s+Function|\bfetch\s*\(/.test(ui));assert(ui.includes("document.addEventListener('calculator:clear-data',reset)"));
});
console.log(`RESULT ${checks} tax-group checks passed, including 312 signed precision/rate oracle cases`);
