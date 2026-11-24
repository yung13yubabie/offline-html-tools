'use strict';
const assert=require('node:assert/strict');
const {createContractsEngine220}=require('../vat/contracts-core.js');
const engine=createContractsEngine220();
const clients=[{id:'client-1'}],category=engine.categoryFor('辦公室'),contractCategories=[category];
const at='2026-05-01T00:00:00.000Z';
const draft={id:'contract-1',clientId:'client-1',categoryId:category.id,title:'合成合約',startDate:'2026-05-05',
 endDate:'2026-05-31',closed:false,reminderEnabled:true,leadMonths:'1',task:'合成待辦',note:''};
const save=(changes={},current=null,time=at)=>engine.save({draft:{...draft,...changes},current,baseline:current,clients,categories:contractCategories,at:time});
const record=save();
const complete=(completed,today='2026-05-01',time=at,current=record)=>engine.updateTask({current,baseline:current,completed,today,at:time});
for(const [end,lead,expected] of [
 ['2026-05-31',1,'2026-04-30'],['2024-03-31',1,'2024-02-29'],['2025-03-31',1,'2025-02-28'],
 ['2026-01-31',2,'2025-11-30'],['2026-10-02',0,'2026-10-02'],['0001-01-02',1,'0001-01-01']
])assert.equal(engine.reminderDate(end,lead),expected);
for(const bad of ['',-1,37,1.5,'2e1',null])assert.throws(()=>save({leadMonths:bad}),{field:'leadMonths'});
assert.equal(engine.categoryFor('ＡＢ').id,engine.categoryFor('ab').id);
assert.equal(engine.categoryFor(' 租約 ').id,'lease');
assert.equal(engine.status(record,'2026-05-01'),'scheduled');
assert.equal(engine.status(record,'2026-05-15'),'upcoming');
assert.equal(engine.status(record,'2026-05-31'),'upcoming');
assert.equal(engine.status(record,'2026-06-01'),'expired');
assert.equal(engine.status(save({startDate:'2026-03-01'}),'2026-04-01'),'active');
assert.equal(engine.status(save({closed:true}),'2026-06-01'),'closed');
assert(!engine.isDue(record,'2026-04-29'));
assert(engine.isDue(record,'2026-04-30'));
assert(engine.isDue(record,'2026-06-01'));
assert(!engine.isDue(save({closed:true}),'2026-06-01'));
assert(!engine.isDue(save({reminderEnabled:false}),'2026-06-01'));
assert.throws(()=>complete(true,'2026-04-29'),/尚未/);
const done=complete(true);
assert(!engine.isDue(done,'2026-05-01'));
assert.equal(save({note:'只更新說明'},done).taskCompletedAt,at);
assert.equal(save({endDate:'2026-06-30'},done).taskCompletedAt,'');
assert.equal(save({leadMonths:'0'},done).taskCompletedAt,'');
assert.equal(complete(false,'2026-05-01',at,done).taskCompletedAt,'');
assert.throws(()=>save({},done,'2026-04-30T00:00:00.000Z'),/時間/);
assert.throws(()=>engine.updateTask({current:done,baseline:record,completed:false,at}),/分頁更新/);
assert.throws(()=>save({endDate:'2026-02-30'}),{field:'endDate'});
assert.throws(()=>save({startDate:'2026-06-01'}),{field:'endDate'});
engine.validate({contracts:[done],contractCategories,clients});
engine.validate({contracts:[done]},{references:false});
engine.validate({});
assert.throws(()=>engine.validate({contracts:[done],contractCategories}),/客戶/);
assert.throws(()=>engine.validate({contracts:[done],clients}),/類別/);
assert.throws(()=>engine.validate({contracts:[done],clients,contractCategories:[category,category]}),/重複/);
console.log('PASS contract month-end/leap cutoffs, statuses, task completion/reopening and backup validation');
const start=engine.shiftDay(record.endDate,1), end=engine.termEnd(start,1);
assert.equal(start,'2026-06-01');
assert.equal(end,'2027-05-31');
assert.equal(engine.shiftDay('2026-12-31',1),'2027-01-01');
assert.equal(engine.termEnd('2024-02-29',1),'2025-02-28');
assert.equal(engine.termEnd('2024-01-01',3),'2026-12-31');
assert.equal(engine.termEnd('9999-12-14',1),'');
const renewal=engine.save({draft:{...draft,id:'extension-1',startDate:start,endDate:end},clients,categories:contractCategories,at,previousContractId:record.id});
assert.equal(engine.successors([record,renewal]).get(record.id).id,renewal.id);
assert.equal(engine.status(record,'2026-06-02',true),'renewed');
assert(!engine.isDue(record,'2026-06-02',true));
assert.equal(engine.status(renewal,'2026-05-01'),'scheduled');
assert.equal(engine.status(renewal,'2026-06-01'),'active');
assert.equal(engine.status(renewal,'2027-05-31'),'upcoming');
assert.equal(engine.status(renewal,'2027-06-01'),'expired');
assert.equal(engine.save({draft:{...renewal,note:'更新續約'},current:renewal,baseline:renewal,clients,categories:contractCategories,at}).previousContractId,record.id);
engine.validate({contracts:[record,renewal],clients,contractCategories});
engine.validate({contracts:[renewal]},{references:false});
assert.throws(()=>engine.validateLinks([renewal]),/缺少上一期/);
assert.throws(()=>engine.validateLinks([record,renewal,{...renewal,id:'extension-2'}]),/兩次/);
assert.throws(()=>engine.validateLinks([record,{...renewal,clientId:'other-client'}]),/同一客戶/);
assert.throws(()=>engine.validateLinks([record,{...renewal,startDate:record.endDate}]),/晚於上期/);
console.log('PASS annual renewals, preserved links, independent statuses and end-date boundaries');

const leases=require('../vat/lease-core.js').createLeaseEngine224();
const lease={...leases.defaultLease(),steps:[
 {from:'2026-05-05',cents:1000000},
 {from:'2026-06-01',cents:1200000},
 {from:'2026-07-01',cents:1200000,remindDays:0},
 {from:'2026-08-01',cents:1150000,remindDays:null}
]};
const withRent=save({endDate:'2026-12-31',reminderEnabled:false,lease});
const [rise,fall]=leases.rentChanges(withRent.lease);
assert.equal(leases.rentChanges(withRent.lease).length,2);
assert.equal(rise.before,1000000);assert.equal(rise.after,1200000);assert.equal(fall.difference,-50000);
assert.equal(engine.rentReminderDate(rise),'2026-05-02');
assert.equal(engine.rentReminderDate(fall),'');
assert.equal(engine.rentReminderDate({...rise,remindDays:0}),rise.date);
assert.equal(engine.rentReminderDate({date:'0001-01-05',remindDays:30}),'0001-01-01');
assert(!engine.rentReminderDue(withRent,rise,'2026-05-01'));
assert(engine.rentReminderDue(withRent,rise,'2026-05-02'));
assert(engine.rentReminderDue(withRent,rise,'2026-06-01'));
assert(!engine.rentReminderDue(withRent,rise,'2026-06-02'));
assert(!engine.rentReminderDue({...withRent,closed:true},rise,'2026-05-02'));
const confirmAt='2026-05-02T00:00:00.000Z';
const confirmed=engine.confirmRentReminder({current:withRent,baseline:withRent,at:confirmAt,today:'2026-05-02',effectiveDate:rise.date});
assert.equal(confirmed.taskCompletedAt,'');
assert.equal(confirmed.lease.steps[1].reminderDoneAt,confirmAt);
assert(!engine.rentReminderDue(confirmed,leases.rentChanges(confirmed.lease)[0],'2026-05-02'));
engine.validate({contracts:[confirmed],clients,contractCategories});
assert.equal(save({endDate:confirmed.endDate,lease,note:'無關的修改'},confirmed,confirmAt).lease.steps[1].reminderDoneAt,confirmAt);
for(const steps of [
 lease.steps.map((step,i)=>i===0?{...step,cents:990000}:step),
 lease.steps.map((step,i)=>i===1?{...step,remindDays:2}:step),
 lease.steps.map((step,i)=>i===1?{...step,from:'2026-06-02'}:step)
]){
 assert.equal(save({endDate:confirmed.endDate,lease:{...lease,steps}},confirmed,confirmAt).lease.steps[1].reminderDoneAt,undefined);
}
assert.throws(()=>leases.rentReminderDays('366'),/365/);
assert.throws(()=>leases.rentReminderDays(''),/整數/);
console.log('PASS staged rent changes, due windows, acknowledgement and rescheduling');
