'use strict';
const assert=require('node:assert/strict');
const {createCasesEngine219}=require('../vat/cases-core.js');
const engine=createCasesEngine219(), clients=[{id:'demo'}], at='2026-11-18T09:00:00.000Z';
const draft={id:'case-1',clientId:'demo',title:'示例',startDate:'2026-11-18',reminderEnabled:true,reminderDate:'2026-11-18',reminderTime:'09:00'};
const created=engine.planSave({draft,clients,at});
assert.equal(created.status,'inProgress');
assert(engine.validateData({cases:[created],clients}));
assert.throws(()=>engine.validateData({cases:[created]}),/有效客戶/);
assert(engine.validateData({cases:[created]},{references:false}));
assert.throws(()=>engine.validateData({cases:[created,created],clients}),/重複/);
assert(engine.reminderDue(created,new Date(2026,10,18,9,0)));
assert(!engine.reminderDue(created,new Date(2026,10,18,8,59)));
assert(!engine.overdue(created,'2026-11-20'));
const acknowledge=(current,when=at)=>engine.acknowledge({current,baseline:current,clients,at:when});
assert.throws(()=>acknowledge(created,'2026-11-17T09:00:00.000Z'),/早於/);
assert.throws(()=>acknowledge({...created,revision:Number.MAX_SAFE_INTEGER}),/版本/);
const confirmed=acknowledge(created);
assert.equal(confirmed.revision,2);
assert.equal(confirmed.reminderCompletedAt,at);
assert(!engine.reminderDue(confirmed,new Date(2026,10,18,9,0)));
const save=(current,fields)=>engine.planSave({current,baseline:current,draft:{...current,...fields},clients,at});
const rescheduled=save(confirmed,{reminderTime:'10:00'});
assert.equal(rescheduled.reminderCompletedAt,'');
const done=save(confirmed,{status:'done'});
assert.equal(done.completedAt,at);
assert(!engine.reminderDue(done,new Date(2026,10,18,12,0)));
const reopened=save(done,{status:'inProgress'});
assert.equal(reopened.completedAt,'');
assert.equal(reopened.reminderCompletedAt,'');
assert.throws(()=>engine.planSave({current:confirmed,baseline:created,draft:created,clients,at}),/其他分頁/);
assert.throws(()=>save(reopened,{dueDate:'2026-11-17'}),/不可早於/);
const progress=[
 {date:'2026-11-19',stage:' 第一批送件 ',note:' 建立追蹤 '},
 {date:'2026-11-18',stage:'備齊文件'},
 {date:'2026-11-19',stage:'受理'}
];
const progressed=save(created,{progress});
assert.deepEqual(engine.progressInOrder(progressed).map(entry=>entry.stage),['備齊文件','第一批送件','受理']);
assert.equal(progressed.progress[0].note,'建立追蹤');
assert(engine.validateData({cases:[progressed],clients}));
assert.deepEqual(acknowledge(progressed).progress,progressed.progress);
assert.throws(()=>save(created,{progress:[{date:'2026-02-30',stage:'錯誤日期'}]}),/日期無效/);
assert.throws(()=>save(created,{progress:[{date:'2026-11-18',stage:'  '}]}),/階段/);
assert.throws(()=>save(created,{progress:Array(engine.maxProgress+1).fill(progress[0])}),/最多/);
console.log('PASS case revisions, reminders, reopen, dates and backup references');
