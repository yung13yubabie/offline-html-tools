'use strict';
const assert = require('node:assert/strict');
const {createAllocationCore19} = require('../calculator/allocation-core.js');
const engine = createAllocationCore19();
const allocate = (amount,start,end,unit='year') => engine.allocate({amount,start,end,unit});

const standard = allocate('1000','2026-09-01','2027-08-31');
assert.equal(standard.totalDays,365);
assert.deepEqual(standard.rows.map(row=>[row.key,row.days,row.cents]),[['2026',122,33425n],['2027',243,66575n]]);
assert.equal(engine.expression(standard,standard.rows[0]),'1,000 × 122/365');
assert.equal(engine.expression(standard,standard.rows[0],{amount:false}),'122/365');
assert.equal(engine.expression(standard,standard.rows[0],{amount:false,result:true}),'122/365 → 334.25');
assert.equal(engine.plaintext(standard,{amount:false,ratio:false,dates:false,result:false}),'');
assert.deepEqual(allocate('1','2024-02-28','2024-03-01','month').rows.map(row=>row.days),[2,1]);
assert.deepEqual(allocate('-0.01','2026-12-31','2027-01-01').rows.map(row=>row.cents),[-1n,0n]);
assert.equal(allocate('0','0001-01-01','0001-01-01').totalDays,1);
for(const date of ['0000-01-01','1900-02-29','2026-04-31','2026-13-01'])assert.throws(()=>allocate('0',date,date),{field:'start'});
assert.throws(()=>allocate('1','2026-12-31','2026-12-30'),{field:'end'});
for(const invalid of ['1,00','1.002','1000000000000','Infinity',''])assert.throws(()=>allocate(invalid,'2000-01-01','2000-01-01'),{field:'amount'});

// Compare generated result groups with a calendar-day oracle independent of the implementation's chunk boundaries.
for(let i=0;i<192;i++){
 const unit=i%2?'year':'month';
 const start=Date.UTC(1995+i%32,i%12,1+i%28), days=1+(103*i)%810;
 const end=start+(days-1)*86400000, from=new Date(start).toISOString().slice(0,10), to=new Date(end).toISOString().slice(0,10);
 const amount=i%3===0?'-999,999,999,999.99':i%3===1?'0.01':'12,000.19', result=allocate(amount,from,to,unit);
 const counts=new Map();
 for(let t=start;t<=end;t+=86400000){
  const key=new Date(t).toISOString().slice(0,unit==='year'?4:7);
  counts.set(key,(counts.get(key)||0)+1);
 }
 assert.deepEqual(result.rows.map(row=>[row.key,row.days]),[...counts]);
 assert.equal(result.rows.reduce((total,row)=>total+row.cents,0n),result.amountCents);
 for(const row of result.rows){
  const error=row.cents*BigInt(days)-result.amountCents*BigInt(row.days);
  assert(error>-BigInt(days)&&error<BigInt(days),'Allocation deviates by less than one cent per group');
 }
}
console.log('PASS allocation examples and 192 independent calendar / exact-cent checks');
