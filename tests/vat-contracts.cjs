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
