/* Cases are independent work records that reference, never overwrite, the customer master. */
function createCasesEngine219(){
 const statuses=['pending','inProgress','done','cancelled'],copy=value=>JSON.parse(JSON.stringify(value));
 const active=status=>status==='pending'||status==='inProgress';
 function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const[y,m,d]=value.split('-').map(Number);if(y<1||m<1||m>12)return false;const leap=y%4===0&&(y%100!==0||y%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];return d>=1&&d<=days[m-1];}
 const time=value=>typeof value==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
 const iso=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
 const id=value=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=300;
 const text=(value,label,max,{required=false,trim=false}={})=>{if(typeof value!=='string')throw new Error(label+'格式錯誤');const out=trim?value.trim():value;if(required&&!out)throw new Error('請填寫'+label);if(out.length>max)throw new Error(label+'最多 '+max+' 字');return out;};
 const maxProgress=120;
 function normalizeProgress(entries=[]){
  if(!Array.isArray(entries)||entries.length>maxProgress)throw Error('每個案件最多 '+maxProgress+' 筆進度紀錄');
  return entries.map((entry,index)=>{
   const label='第 '+(index+1)+' 筆進度';
   if(!date(entry?.date))throw Error(label+'的日期無效');
   return {date:entry.date,stage:text(entry.stage,label+'階段',120,{required:true,trim:true}),
    note:text(entry.note??'',label+'說明',1000,{trim:true})};
  });
 }
 const progressInOrder=record=>(record.progress||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
 function normalize(raw,{clients=[],creation=false,today='',references=true}={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('案件資料格式錯誤');
  const clientId=raw.clientId;if(!id(clientId)||references&&!clients.some(client=>client.id===clientId))throw new Error('請選擇客戶庫中的有效客戶');
  const status=raw.status===undefined&&creation?'inProgress':raw.status;if(!statuses.includes(status))throw new Error('案件狀態無效，請重新選擇');
  const optional=(value,label)=>{if(value===undefined)return '';if(typeof value!=='string')throw new Error(label+'格式錯誤');return value;};
  const title=text(raw.title,'案件名稱',200,{required:true,trim:true}),note=text(optional(raw.note,'案件備註'),'案件備註',12000),startDate=raw.startDate===undefined&&creation?today:raw.startDate;
  if(!date(startDate))throw new Error('請填寫有效開始日期');const dueDate=optional(raw.dueDate,'截止日期'),dueTime=optional(raw.dueTime,'截止時間');
  if(dueDate&&!date(dueDate))throw new Error('截止日期格式錯誤');if(dueDate&&dueDate<startDate)throw new Error('截止日期不可早於開始日期');if(dueTime&&(!dueDate||!time(dueTime)))throw new Error('填寫截止時間前，請先選擇有效截止日期');
  if(raw.reminderEnabled!==undefined&&typeof raw.reminderEnabled!=='boolean')throw new Error('案件提醒設定格式錯誤');const reminderEnabled=raw.reminderEnabled===true,reminderDate=optional(raw.reminderDate,'提醒日期'),reminderTime=optional(raw.reminderTime,'提醒時間');
  if(reminderDate&&!date(reminderDate))throw new Error('提醒日期格式錯誤');if(reminderTime&&!time(reminderTime))throw new Error('提醒時間格式錯誤');if(reminderEnabled&&(!date(reminderDate)||!time(reminderTime)))throw new Error('請填寫提醒日期與時間');
  const progress=normalizeProgress(raw.progress);
  return {clientId,title,status,startDate,dueDate,dueTime,reminderEnabled,reminderDate,reminderTime,note,...(progress.length?{progress}:{})};
 }
 function canonical(record){if(!record)return null;const sort=value=>Array.isArray(value)?value.map(sort):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])])):value;return JSON.stringify(sort(record));}
 function assertBaseline(current,baseline){if(!current)throw new Error('案件已被刪除，請重新整理');if(!baseline||current.id!==baseline.id||current.revision!==baseline.revision||canonical(current)!==canonical(baseline))throw new Error('案件已由其他分頁更新，請重新開啟後再儲存');}
 const schedule=record=>JSON.stringify([record.startDate,record.dueDate,record.dueTime,record.reminderEnabled,record.reminderDate,record.reminderTime]);
 function planSave({current=null,baseline=null,draft,clients=[],at,today}={}){
  if(!iso(at))throw new Error('案件操作時間無效');if(current){assertBaseline(current,baseline);if(current.version!==1||!Number.isSafeInteger(current.revision)||current.revision<1||current.revision>=Number.MAX_SAFE_INTEGER||!iso(current.createdAt)||!iso(current.updatedAt))throw new Error('案件來源版本或時間無效');if(at<current.createdAt)throw new Error('本機時間早於案件建立時間，請先核對日期');}else if(baseline)throw new Error('案件已被刪除，請重新整理');
  if(!id(draft?.id))throw new Error('案件編號無效');if(current&&draft.id!==current.id)throw new Error('案件編號不可變更');const fields=normalize(draft,{clients,creation:!current,today});
  const reopened=current&&!active(current.status)&&active(fields.status),changedSchedule=current&&schedule(fields)!==schedule(current),reminderCompletedAt=!current||reopened||changedSchedule?'':current.reminderCompletedAt||'';
  return {id:draft.id,version:1,...fields,reminderCompletedAt,completedAt:fields.status==='done'?(current?.status==='done'?current.completedAt:at):'',revision:current?current.revision+1:1,createdAt:current?.createdAt||at,updatedAt:at};
 }
 function acknowledge({current,baseline,clients=[],at}={}){if(!iso(at))throw new Error('案件操作時間無效');assertBaseline(current,baseline);if(!active(current.status)||!current.reminderEnabled)throw new Error('案件目前沒有待確認的提醒');const next=planSave({current,baseline,draft:current,clients,at});if(current.reminderCompletedAt)return copy(current);return {...next,reminderCompletedAt:at};}
 function validateData(data={},{references=true}={}){
  if(data.cases===undefined)return true;if(!Array.isArray(data.cases))throw new Error('案件備份格式錯誤');const seen=new Set(),clients=Array.isArray(data.clients)?data.clients:[];
  for(const record of data.cases){if(!record||!id(record.id)||seen.has(record.id))throw new Error('案件含重複或無效編號');seen.add(record.id);if(record.version!==1||!Number.isSafeInteger(record.revision)||record.revision<1)throw new Error('案件資料版本無效');normalize(record,{clients,references});if(!iso(record.createdAt)||!iso(record.updatedAt))throw new Error('案件記錄時間無效');if(record.updatedAt<record.createdAt)throw new Error('案件更新時間不可早於建立時間');if(record.reminderCompletedAt&&!iso(record.reminderCompletedAt))throw new Error('案件提醒完成時間無效');if(record.status==='done'?!iso(record.completedAt):!!record.completedAt)throw new Error('案件完成狀態與時間不一致');}
  return true;
 }
 function reminderDue(record,now=new Date()){if(!active(record?.status)||!record.reminderEnabled||record.reminderCompletedAt||!date(record.reminderDate)||!time(record.reminderTime))return false;const instant=new Date(record.reminderDate+'T'+record.reminderTime+':00');return Number.isFinite(instant.getTime())&&instant<=now;}
 function overdue(record,today,clock='23:59'){if(!active(record?.status)||!record.dueDate||!date(record.dueDate)||!date(today))return false;return record.dueDate<today||record.dueDate===today&&!!record.dueTime&&time(clock)&&record.dueTime<clock;}
 return {statuses:statuses.slice(),active,date,time,iso,normalize,planSave,acknowledge,assertBaseline,validateData,reminderDue,overdue,maxProgress,progressInOrder};
}
function validateCases219(data,options){return createCasesEngine219().validateData(data,options);}
if(typeof module!=='undefined'&&module.exports)module.exports={createCasesEngine219,validateCases219};
