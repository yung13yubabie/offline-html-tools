/* Contract terms, calendar-month deadlines and one task per saved contract. */
function createContractsEngine220() {
 const dates = (typeof module !== 'undefined' && module.exports
  ? require('./cases-core.js').createCasesEngine219 : createCasesEngine219)();
 const builtins = [{id:'lease',name:'租約'},{id:'other',name:'其他'}];
 const idOK = value => typeof value === 'string' && /^[^<>"'\x00-\x1f]{1,300}$/.test(value) && value.trim() === value;
 const fail = (field,message) => {const error=new Error(message);error.field=field;throw error;};

 function text(raw,field,label,max,required=false) {
  if(typeof raw!=='string')fail(field,label+'格式錯誤');
  const value=raw.trim();
  if(required&&!value)fail(field,'請填寫'+label);
  if(value.length>max)fail(field,label+'最多 '+max+' 字');
  return value;
 }
 function categoryFor(raw) {
  const name=text(raw,'categoryName','類別名稱',32,true);
  const key=name.normalize('NFKC').toLowerCase();
  const existing=builtins.find(row=>row.name.normalize('NFKC')===key);
  if(existing)return {...existing};
  const id='ct:'+Array.from(key,char=>char.codePointAt(0).toString(16)).join('-');
  if(!idOK(id))fail('categoryName','類別名稱過長，請縮短後重試');
  return {id,name};
 }
 function months(raw) {
  if(typeof raw==='string'&&/^\d{1,2}$/.test(raw))raw=Number(raw);
  if(!Number.isInteger(raw)||raw<0||raw>36)fail('leadMonths','請輸入 0 至 36 個月的整數');
  return raw;
 }
 function reminderDate(endDate,leadMonths) {
  if(!dates.date(endDate))return '';
  const [year,month,day]=endDate.split('-').map(Number);
  const index=(year-1)*12+month-1-months(leadMonths);
  if(index<0)return '0001-01-01';
  const targetYear=Math.floor(index/12)+1,targetMonth=index%12+1;
  const prefix=String(targetYear).padStart(4,'0')+'-'+String(targetMonth).padStart(2,'0')+'-';
  let targetDay=day;
  while(!dates.date(prefix+String(targetDay).padStart(2,'0')))targetDay--;
  return prefix+String(targetDay).padStart(2,'0');
 }
 function status(record,today) {
  if(record.closed)return 'closed';
  if(record.endDate<today)return 'expired';
  if(record.startDate&&today<record.startDate)return 'scheduled';
  return reminderDate(record.endDate,record.leadMonths)<=today?'upcoming':'active';
 }
 function isDue(record,today) {
  return !record.closed&&record.reminderEnabled&&!record.taskCompletedAt&&reminderDate(record.endDate,record.leadMonths)<=today;
 }
 function normalize(raw,{clients=[],categories=[],references=true}={}) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('title','合約格式錯誤');
  const {clientId,categoryId,startDate,endDate,closed,reminderEnabled}=raw;
  if(!idOK(clientId)||references&&!clients.some(row=>row.id===clientId))fail('clientId','請選擇客戶庫中的有效客戶');
  if(!idOK(categoryId)||references&&![...builtins,...categories].some(row=>row.id===categoryId))fail('categoryId','請選擇有效合約類別');
  if(startDate!==''&&!dates.date(startDate))fail('startDate','請核對開始日期');
  if(!dates.date(endDate))fail('endDate','請填寫有效到期日');
  if(startDate&&startDate>endDate)fail('endDate','到期日不可早於開始日期');
  if(typeof closed!=='boolean'||typeof reminderEnabled!=='boolean')fail('closed','合約狀態或提醒設定格式錯誤');
  const leadMonths=months(raw.leadMonths);
  return {clientId,categoryId,startDate,endDate,closed,reminderEnabled,leadMonths,
   title:text(raw.title,'title','合約名稱',200,true),
   task:text(raw.task,'task','待辦事項',240,reminderEnabled),
   note:text(raw.note,'note','備註',12000)};
 }
 function assertBaseline(current,baseline) {
  if(!current)throw Error('合約已被刪除，請重新整理');
  if(!baseline||current.revision!==baseline.revision||JSON.stringify(current)!==JSON.stringify(baseline))throw Error('合約已由其他分頁更新，請重新開啟後再儲存');
 }
 function startWrite(current,baseline,at) {
  if(!dates.iso(at))throw Error('合約操作時間無效');
  if(!current&&!baseline)return;
  assertBaseline(current,baseline);
  if(current.revision>=Number.MAX_SAFE_INTEGER||at<current.updatedAt)throw Error('合約版本或本機時間無效');
 }
 function save({draft,current=null,baseline=null,clients,categories,at}) {
  startWrite(current,baseline,at);
  if(!idOK(draft?.id)||current&&current.id!==draft.id)throw Error('合約編號無效');
  const fields=normalize(draft,{clients,categories});
  const changedSchedule=current&&['endDate','leadMonths','reminderEnabled'].some(key=>current[key]!==fields[key]);
  const restart=current?.closed&&!fields.closed;
  const taskCompletedAt=!current||changedSchedule||restart?'':current.taskCompletedAt;
  return {id:draft.id,version:1,...fields,taskCompletedAt,revision:(current?.revision||0)+1,createdAt:current?.createdAt||at,updatedAt:at};
 }
 function updateTask({current,baseline,at,today,completed}) {
  startWrite(current,baseline,at);
  if(!current||!current.reminderEnabled||current.closed)throw Error('合約目前無啟用中的待辦');
  if(completed&&!isDue(current,today))throw Error('待辦尚未到提醒日或已完成');
  return {...current,taskCompletedAt:completed?at:'',revision:current.revision+1,updatedAt:at};
 }
 function validate(data,{references=true}={}) {
  const {contracts=[],contractCategories=[],clients=[]}=data;
  if(!Array.isArray(contracts)||!Array.isArray(contractCategories))throw Error('合約或類別資料格式錯誤');
  const types=new Set(),ids=new Set();
  for(const row of contractCategories){
   if(!row||!idOK(row.id)||builtins.some(type=>row.id===type.id)||categoryFor(row.name).id!==row.id||types.has(row.id))throw Error('合約類別重複或無效');
   types.add(row.id);
  }
  for(const row of contracts){
   if(!row||!idOK(row.id)||ids.has(row.id))throw Error('合約編號重複或無效');
   ids.add(row.id);
   normalize(row,{clients,categories:contractCategories,references});
   if(row.version!==1||!Number.isSafeInteger(row.revision)||row.revision<1||
    !dates.iso(row.createdAt)||!dates.iso(row.updatedAt)||row.updatedAt<row.createdAt||
    (row.taskCompletedAt!==''&&(!dates.iso(row.taskCompletedAt)||row.taskCompletedAt<row.createdAt||row.taskCompletedAt>row.updatedAt))){
    throw Error('合約版本或日期紀錄無效');
   }
  }
 }
 return {builtins,categoryFor,months,reminderDate,status,isDue,normalize,assertBaseline,save,updateTask,validate};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createContractsEngine220};
