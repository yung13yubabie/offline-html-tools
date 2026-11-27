/* Contract terms, calendar-month deadlines and one task per saved contract. */
function createContractsEngine220() {
 const dates = (typeof module !== 'undefined' && module.exports
  ? require('./cases-core.js').createCasesEngine219 : createCasesEngine219)();
 const leases=(typeof module!=='undefined'&&module.exports
  ? require('./lease-core.js').createLeaseEngine224 : createLeaseEngine224)();
 const withholding=(typeof module!=='undefined'&&module.exports
  ? require('./lease-withholding-core.js').createLeaseWithholding238 : createLeaseWithholding238)();
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
 function shiftDay(date,days) {
  if(!dates.date(date))return '';
  const instant=new Date(date+'T00:00:00.000Z');
  instant.setUTCDate(instant.getUTCDate()+days);
  const result=instant.toISOString().slice(0,10);
  return dates.date(result)?result:'';
 }
 function termEnd(start,years) {
  if(!dates.date(start)||!Number.isInteger(years)||years<1||years>3)return '';
  const year=Number(start.slice(0,4))+years;
  if(year>9999)return '';
  const anniversary=String(year).padStart(4,'0')+start.slice(4);
  return dates.date(anniversary)?shiftDay(anniversary,-1):anniversary.slice(0,8)+'28';
 }
 function successors(rows) {
  return new Map(rows.filter(row=>row.previousContractId).map(row=>[row.previousContractId,row]));
 }
 function validateLinks(rows,{references=true,changedIds}={}) {
  const ids=new Map(rows.map(row=>[row.id,row])),seen=new Set();
  const touched=new Set(changedIds||[]),previousIds=new Set([...touched].map(id=>ids.get(id)?.previousContractId));
  for(const row of rows){
   const prior=row.previousContractId;
   if(prior===undefined||prior==='')continue;
   if(changedIds&&!touched.has(row.id)&&!touched.has(prior)&&!previousIds.has(prior))continue;
   if(!idOK(prior)||prior===row.id||seen.has(prior))throw Error('續約關聯格式錯誤或同一合約續約兩次');
   seen.add(prior);
   const previous=ids.get(prior);
   if(!previous){if(references)throw Error('續約缺少上一期合約');continue;}
   if(previous.clientId!==row.clientId)fail('clientId','續約前後必須是同一客戶');
   if(!row.startDate||row.startDate<=previous.endDate)fail('startDate','續約開始日須晚於上期到期日');
  }
 }
 function renewalLease(previous,startDate) {
  if(!previous.lease)return undefined;
  const old=leases.normalize(previous.lease,previous.startDate,previous.endDate);
  const last=old.steps.at(-1);
  return {...leases.defaultLease(),frequency:old.frequency,rentBasis:old.rentBasis,deposit:old.deposit,
   regime:old.regime,vatRate:old.vatRate,rentVatRate:old.rentVatRate,steps:last?[{from:startDate,cents:last.cents}]:[]};
 }
 function status(record,today,renewed=false) {
  if(renewed)return 'renewed';
  if(record.closed)return 'closed';
  if(record.endDate<today)return 'expired';
  if(record.startDate&&today<record.startDate)return 'scheduled';
  return reminderDate(record.endDate,record.leadMonths)<=today?'upcoming':'active';
 }
 function isDue(record,today,renewed=false) {
  return !renewed&&!record.closed&&record.reminderEnabled&&!record.taskCompletedAt&&reminderDate(record.endDate,record.leadMonths)<=today;
 }
 function rentReminderDate(change){
  return change.remindDays===null?'':shiftDay(change.date,-change.remindDays)||'0001-01-01';
 }
 function rentReminderDue(record,change,today){
  const date=rentReminderDate(change);
  return !record.closed&&!!date&&!change.doneAt&&date<=today&&today<=change.date;
 }
 function normalizeNotices(notices) {
  if(!Array.isArray(notices))fail('notice','通知紀錄格式錯誤');
  return notices.map(row=>{
   if(!dates.iso(row?.at)||!dates.date(row.start)||!dates.date(row.end)||row.end<row.start||
      !['issues','missing','rent','interest'].includes(row.mode))fail('notice','通知紀錄日期或類別有誤');
   return {at:row.at,start:row.start,end:row.end,mode:row.mode,content:text(row.content,'notice','通知內容',12000,true)};
  });
 }
 function normalizeRental(raw={}) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('lessorKind','出租資料格式有誤');
  const {kind='company',address='',name='',contact=''}=raw;
  if(!['company','individual'].includes(kind))fail('lessorKind','請選擇出租對象');
  const rental={kind,address:text(address,'rentalAddress','租賃地址',300),name:text(name,'lessorName','出租方名稱',120),
   contact:text(contact,'lessorContact','出租方聯絡方式',120)};
  return kind==='individual'||rental.address||rental.name||rental.contact?rental:undefined;
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
  const rental=normalizeRental(raw.rental),leasePayments=withholding.normalize(raw.leasePayments);
  return {clientId,categoryId,startDate,endDate,closed,reminderEnabled,leadMonths,
   title:text(raw.title,'title','合約名稱',200,true),
   task:text(raw.task,'task','待辦事項',240,reminderEnabled),
   note:text(raw.note,'note','備註',12000),...(raw.lease===undefined?{}:{lease:leases.normalize(raw.lease,startDate,endDate)}),
   ...(raw.leaseNotices===undefined?{}:{leaseNotices:normalizeNotices(raw.leaseNotices)}),
   ...(rental?{rental}:{}),...(leasePayments.length?{leasePayments}:{})};
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
 function relinkMissingCustomer(rows,current,clientId,at){
  const sameClient=rows.filter(row=>row.clientId===current.clientId);
  const byId=new Map(sameClient.map(row=>[row.id,row])),next=successors(sameClient);
  const visited=new Set([current.id]),queue=[current],relinked=[];
  for(const row of queue){
   for(const linked of [byId.get(row.previousContractId),next.get(row.id)]){
    if(!linked||visited.has(linked.id))continue;
    visited.add(linked.id);
    startWrite(linked,linked,at);
    queue.push(linked);
    relinked.push({...linked,clientId,revision:linked.revision+1,updatedAt:at});
   }
  }
  return relinked;
 }
 function save({draft,current=null,baseline=null,clients,categories,at,previousContractId=current?.previousContractId}) {
  startWrite(current,baseline,at);
  if(!idOK(draft?.id)||current&&current.id!==draft.id)throw Error('合約編號無效');
  const fields=normalize(draft,{clients,categories});
  if(fields.lease)fields.lease=leases.carryRentConfirmations(current?.lease,fields.lease);
  const changedSchedule=current&&['endDate','leadMonths','reminderEnabled'].some(key=>current[key]!==fields[key]);
  const restart=current?.closed&&!fields.closed;
  const taskCompletedAt=!current||changedSchedule||restart?'':current.taskCompletedAt;
  return {id:draft.id,version:1,...fields,...(previousContractId?{previousContractId}:{}),taskCompletedAt,revision:(current?.revision||0)+1,createdAt:current?.createdAt||at,updatedAt:at};
 }
 function updateTask({current,baseline,at,today,completed}) {
  startWrite(current,baseline,at);
  if(!current||!current.reminderEnabled||current.closed)throw Error('合約目前無啟用中的待辦');
  if(completed&&!isDue(current,today))throw Error('待辦尚未到提醒日或已完成');
  return {...current,taskCompletedAt:completed?at:'',revision:current.revision+1,updatedAt:at};
 }
 function confirmRentReminder({current,baseline,at,today,effectiveDate}){
  startWrite(current,baseline,at);
  const change=leases.rentChanges(current?.lease).find(row=>row.date===effectiveDate);
  if(!change||!rentReminderDue(current,change,today))throw Error('這筆調租提醒目前無法確認');
  const steps=current.lease.steps.map(step=>step.from===effectiveDate?{...step,reminderDoneAt:at}:step);
  return {...current,lease:{...current.lease,steps},revision:current.revision+1,updatedAt:at};
 }
 function validate(data,{references=true}={}) {
  const {contracts=[],contractCategories=[],clients=[],leaseRates=[]}=data;
  leases.validateRates(leaseRates);
  if(!Array.isArray(contracts)||!Array.isArray(contractCategories))throw Error('合約或類別資料格式錯誤');
  const types=new Set(),ids=new Set();
  for(const row of contractCategories){
   if(!row||!idOK(row.id)||builtins.some(type=>row.id===type.id)||categoryFor(row.name).id!==row.id||types.has(row.id))throw Error('合約類別重複或無效');
   types.add(row.id);
  }
  for(const row of contracts){
   if(!row||!idOK(row.id)||ids.has(row.id))throw Error('合約編號重複或無效');
   ids.add(row.id);
   const fields=normalize(row,{clients,categories:contractCategories,references});
   if(row.version!==1||!Number.isSafeInteger(row.revision)||row.revision<1||
    !dates.iso(row.createdAt)||!dates.iso(row.updatedAt)||row.updatedAt<row.createdAt||
    (row.taskCompletedAt!==''&&(!dates.iso(row.taskCompletedAt)||row.taskCompletedAt<row.createdAt||row.taskCompletedAt>row.updatedAt))){
    throw Error('合約版本或日期紀錄無效');
   }
   if(fields.lease?.steps.some(step=>step.reminderDoneAt&&(step.reminderDoneAt<row.createdAt||step.reminderDoneAt>row.updatedAt))){
    throw Error('調租提醒確認時間超出合約記錄範圍');
   }
  }
  validateLinks(contracts,{references});
 }
 return {builtins,categoryFor,months,reminderDate,status,isDue,normalize,assertBaseline,save,updateTask,validate,validateLinks,successors,shiftDay,termEnd,renewalLease,
  rentReminderDate,rentReminderDue,confirmRentReminder,relinkMissingCustomer};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createContractsEngine220};
