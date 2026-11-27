'use strict';
const assert=require('node:assert/strict');
const {createLeaseWithholding238}=require('../vat/lease-withholding-core.js');
const {createContractsEngine220}=require('../vat/contracts-core.js');
const engine=createLeaseWithholding238();
const payment={id:'synthetic-pay-1',date:'2026-11-01',amount:2_000_000,residency:'resident',
 nhiRule:'standard',taxActual:null,nhiActual:42_200,note:'合成給付'};
const amounts=(amount,overrides)=>engine.calculate({...payment,amount,...overrides});
assert.deepEqual(amounts(1_999_900),{tax:0,nhi:0});
assert.deepEqual(amounts(2_000_000),{tax:0,nhi:42_200});
assert.deepEqual(amounts(2_001_000),{tax:200_100,nhi:42_200});
assert.deepEqual(amounts(3_600_000),{tax:360_000,nhi:76_000});
assert.deepEqual(amounts(60_000_000),{tax:6_000_000,nhi:1_266_000});
assert.deepEqual(amounts(1_200_000_000),{tax:120_000_000,nhi:21_100_000});
assert.deepEqual(amounts(500_000,{residency:'nonresident'}),{tax:100_000,nhi:0});
assert.deepEqual(amounts(2_500_000,{nhiRule:'exempt'}),{tax:250_000,nhi:0});
assert.deepEqual(amounts(2_949_999,{nhiRule:'special',nhiMin:2_950_000}),{tax:294_900,nhi:0});
assert.deepEqual(amounts(2_950_000,{nhiRule:'special',nhiMin:2_950_000}),{tax:295_000,nhi:62_200});
assert.deepEqual(engine.normalize([payment]),[payment]);
assert.throws(()=>engine.normalize([payment,payment]),/重複/);
for(const [key,value] of [['date','2020-12-31'],['date','2026-02-29'],['amount',-1],['amount',0],['residency','other'],
 ['nhiRule','special'],['nhiActual',-1],['note',100]])assert.throws(()=>engine.normalize([{...payment,[key]:value}]));

const contracts=createContractsEngine220(),clients=[{id:'synthetic-a'}];
const draft={id:'synthetic-contract',clientId:'synthetic-a',categoryId:'lease',title:'合成租約',startDate:'2026-01-01',
 endDate:'2026-12-31',closed:false,reminderEnabled:true,leadMonths:1,task:'確認續約',note:''};
const at='2026-01-01T00:00:00.000Z',settings={clients,categories:[],at};
assert.equal(contracts.save({draft,...settings}).rental,undefined);
const rental={kind:'individual',address:'合成路 1 號',name:'合成房東',contact:''};
const record=contracts.save({draft:{...draft,rental,leasePayments:[payment]},...settings});
assert.deepEqual(record.rental,rental);
assert.deepEqual(contracts.normalize(record,{clients}).leasePayments,[payment]);
contracts.validate({clients,contracts:[record]});
assert.throws(()=>contracts.validate({clients,contracts:[{...record,leasePayments:[{...payment,taxActual:'10'}]}]}),/實扣金額/);
assert.throws(()=>contracts.validate({clients,contracts:[{...record,rental:{...rental,kind:'unknown'}}]}),/出租對象/);
console.log('PASS per-payment withholding, independent boundaries, cap, exemptions and contract backup validation');

assert.deepEqual(engine.policy(),{residency:'resident',nhiRule:'standard'});
const terms={residency:'nonresident',nhiRule:'special',nhiMin:2_950_000};
assert.deepEqual(engine.policy(terms),terms);
const explicit=contracts.save({draft:{...draft,rental:{...rental,withholding:terms}},...settings});
assert.deepEqual(explicit.rental.withholding,terms);
assert.throws(()=>contracts.save({draft:{...draft,rental:{...rental,withholding:{...terms,nhiMin:0}}},...settings}),/健保門檻/);
const noBatchRecord={...payment,id:'old-1',rentMonth:'2026-11',nhiActual:null};
const second={...payment,id:'old-2',rentMonth:'2026-12',...terms,nhiActual:null};
const prior=[noBatchRecord,second];
assert.throws(()=>engine.normalize([noBatchRecord,{...second,rentMonth:'2026-11'}]),/月租月份無效或重複/);
const updates=new Map([['old-1',{taxActual:0,nhiActual:42_000}]]);
assert.deepEqual(engine.reconcile(prior,updates,{fill:true}),[{...noBatchRecord,taxActual:0,nhiActual:42_000},second]);
const compareOnly=new Map([['old-2',{taxActual:null,nhiActual:0}]]);
assert.deepEqual(engine.reconcile(prior,compareOnly),[noBatchRecord,{...second,nhiActual:0}]);
assert.deepEqual(engine.reconcile(prior,compareOnly,{fill:true})[1],{...second,taxActual:400_000,nhiActual:0});
assert.throws(()=>engine.reconcile(prior,new Map([['old-1',{taxActual:0,nhiActual:-1}]])),/實扣金額/);
