/* A carried accounting item has one completion state; period descriptions stay local. */
function createAccountingLinkEngine218(){
 'use strict';
 const fields=['accountingMissingDocs','accountingReturnItems'],copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x)),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),status=x=>x?.status==='done'?'done':'pending';
 const iso=x=>typeof x==='string'&&x!==''&&Number.isFinite(+new Date(x))?new Date(x).toISOString():'';
 const completion=x=>status(x)==='done'?iso(x?.completedAt):'';
 const root=x=>x?.lineageRootId||x?.sourceItemId||x?.id||'';
 function identity(pc,field,item){return pc?.clientId&&fields.includes(field)&&root(item)?JSON.stringify([pc.clientId,field,item.sourcePeriodId||pc.periodId,root(item)]):'';}
 function metadata(item){const m=item?.accountingLink218;return m&&m.version===1&&Number.isSafeInteger(m.revision)&&m.revision>=1&&['done','pending'].includes(m.status)&&iso(m.changedAt)&&typeof m.changedPCId==='string'&&m.changedPCId?m:null;}
 function metaSignature(m){return m?[m.version,m.revision,m.status,m.status==='done'?iso(m.completedAt):'',iso(m.changedAt),m.changedPCId]:null;}
 function signature(item){return JSON.stringify([status(item),completion(item),metaSignature(metadata(item))]);}
 function rowMap(rows){const map=new Map();for(const pc of rows||[]){if(!pc||typeof pc.id!=='string'||!pc.id||map.has(pc.id))throw new Error('帳務工作紀錄編號重複或無效');for(const field of fields){if(pc[field]!=null&&!Array.isArray(pc[field]))throw new Error('帳務明細必須是清單');const ids=new Set();for(const item of pc[field]||[]){if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id))throw new Error('帳務明細編號重複或無效');ids.add(item.id);}}map.set(pc.id,pc);}return map;}
 function index(rows){const out=new Map();for(const pc of rows)for(const field of fields)for(const item of pc[field]||[]){const key=identity(pc,field,item);if(!key)continue;const refs=out.get(key)||[];refs.push({pc,field,item});out.set(key,refs);}return out;}
 function eventSignature(refs=[]){const metas=refs.map(r=>metadata(r.item)).filter(Boolean);if(metas.length){const max=Math.max(...metas.map(m=>m.revision));return JSON.stringify([...new Set(metas.filter(m=>m.revision===max).map(m=>JSON.stringify(metaSignature(m))))].sort());}return JSON.stringify([...new Set(refs.map(r=>JSON.stringify([status(r.item),completion(r.item)])))].sort());}
 function unlocked(pc,periodMap){const p=periodMap.get(pc.periodId);if(!p)throw new Error('帳務來源期別已不存在');if(p.status==='已結束'&&!p.unlocked)throw new Error('帳務來源期別已結束，請先解鎖該期再直接修改');}
 function untouched(item,pc){return status(item)==='pending'&&!item.completedAt&&!item.accountingLink218&&!item.taskPlan&&iso(item.createdAt)&&iso(item.createdAt)===iso(item.updatedAt)&&(!item.recordedAt||iso(item.recordedAt)===iso(item.createdAt))&&(!item.carriedAt||iso(item.carriedAt)===iso(item.createdAt))&&(!item.isCarried||!!item.continuedFromPeriodId||item.sourcePeriodId&&item.sourcePeriodId!==pc.periodId);}
 function syncItem(item,shared,at){item.status=shared.status;item.completedAt=shared.status==='done'?shared.completedAt:'';item.accountingLink218=copy(shared);if(item.taskPlan){if(shared.status==='pending')item.taskPlan.reminderCompletedAt='';else if(item.taskPlan.reminderEnabled)item.taskPlan.reminderCompletedAt=shared.completedAt||item.taskPlan.reminderCompletedAt||at;}}
 function review(key,refs,reason,periodMap){const [clientId,field,sourcePeriodId,rootId]=JSON.parse(key);return {key,clientId,field,sourcePeriodId,rootId,reason,items:refs.map(({pc,item})=>({pcId:pc.id,itemId:item.id,periodId:pc.periodId,status:status(item),completedAt:completion(item),revision:metadata(item)?.revision||0})),eligiblePCIds:[...new Set(refs.filter(({pc})=>{const p=periodMap.get(pc.periodId);return p&&!(p.status==='已結束'&&!p.unlocked)}).map(r=>r.pc.id))]};}
 function sharedEvent(ref,desired,at,revision,completedAt){return {version:1,revision,status:desired,completedAt:desired==='done'?(iso(completedAt)||at):'',changedAt:at,changedPCId:ref.pc.id};}
 function plan(input){
  const {beforeRows=[],proposedRows=beforeRows,baselineRows=beforeRows,periods=[],changedIds=[],mode='edit',resolutions=[]}=input||{},at=iso(input?.at);if(!at)throw new Error('聯動操作時間無效');if(!['edit','seed','resolve'].includes(mode))throw new Error('不支援的帳務聯動模式');
  const oldMap=rowMap(beforeRows),baseMap=rowMap(baselineRows),proposedMap=rowMap(proposedRows),periodMap=new Map(periods.map(p=>[p.id,p])),rows=copy(mode==='seed'?proposedRows:beforeRows.filter(pc=>proposedMap.has(pc.id))),outMap=rowMap(rows),oldIndex=index(beforeRows),baseIndex=index(baselineRows),events={changes:[],review:[]},intents=new Map(),directIds=new Set(changedIds);
  function request(ref,desired,date,resolve=false){
   const key=identity(ref.pc,ref.field,ref.item);if(!key)throw new Error('帳務明細缺少可追溯來源');const peers=oldIndex.get(key)||[],baseline=baseIndex.get(key)||[];
   if(eventSignature(peers)!==eventSignature(baseline))throw new Error('跨期帳務完成狀態已被其他操作變更，請重新載入後再處理');
   const duplicate=new Set();for(const peer of peers){if(duplicate.has(peer.pc.id))throw new Error('同一期含重複的帳務延續來源，請先核對明細');duplicate.add(peer.pc.id);}
   const existing=intents.get(key);if(existing&&existing.status!==desired)throw new Error('同一跨期事項不能在同一批次同時設為已完成與待處理');
   if(existing&&date&&existing.completedAt&&iso(date)!==existing.completedAt)throw new Error('同一跨期事項的完成時間互相衝突');
   if(!existing){const revision=Math.max(0,...peers.map(r=>metadata(r.item)?.revision||0))+1;intents.set(key,{...sharedEvent(ref,desired,at,revision,date),resolve});}
  }
  if(mode!=='seed')for(const pcId of directIds){
   const proposed=proposedMap.get(pcId);if(!proposed){if(oldMap.has(pcId))continue;throw new Error('缺少本次帳務工作資料');}const old=oldMap.get(pcId),baseline=baseMap.get(pcId),next={...copy(old||{}),...copy(proposed)};
   if(old&&(next.clientId!==old.clientId||next.periodId!==old.periodId))throw new Error('帳務工作來源不可更換客戶或期別');let localEdit=false;
   for(const field of fields){
    const oldItems=new Map((old?.[field]||[]).map(x=>[x.id,x])),baseItems=new Map((baseline?.[field]||[]).map(x=>[x.id,x])),incoming=new Map((proposed[field]||[]).map(x=>[x.id,x])),arr=[],excluded=new Set([...(old?.accountingExcludedRoots?.[field]||[]),...(proposed.accountingExcludedRoots?.[field]||[])]);
    for(const [id,current]of oldItems)if(!incoming.has(id)){
     if(baseItems.has(id)){if(signature(current)!==signature(baseItems.get(id)))throw new Error('欲移除的帳務事項已被其他操作更新，請重新載入');excluded.add(root(current));localEdit=true;}
     else arr.push(copy(current));
    }
    for(const [id,item]of incoming){const current=oldItems.get(id),base=baseItems.get(id);
     if(!current&&base){if(!equal(item,base))throw new Error('欲修改的帳務事項已被刪除，請重新載入');continue;}
     if(current&&base&&(identity(old,field,current)!==identity(baseline,field,base)||identity(next,field,item)!==identity(old,field,current)))throw new Error('帳務延續來源已變更，請重新載入');
     if(!current&&excluded.has(root(item)))throw new Error('已排除的帳務延續事項不能由舊畫面恢復');
     if(current&&!base&&baseline)throw new Error('帳務明細編號已被其他操作使用，請重新載入');
     const merged={...copy(current||{}),...copy(item)};
     if(current&&base)for(const key of Object.keys(current))if(equal(item[key],base[key]))merged[key]=copy(current[key]);
     const explicit=!base||status(item)!==status(base)||completion(item)!==completion(base);
     if(explicit){if(current&&base&&signature(current)!==signature(base))throw new Error('跨期帳務完成狀態已被其他操作變更，請重新載入後再處理');localEdit=true;request({pc:next,field,item:merged},status(item),completion(item));}
     else if(current){merged.status=current.status;merged.completedAt=current.completedAt||'';if(current.accountingLink218)merged.accountingLink218=copy(current.accountingLink218);else delete merged.accountingLink218;if(merged.taskPlan){const sameShared=signature(current)===signature(base),explicitReminder=!equal(item.taskPlan?.reminderCompletedAt,base?.taskPlan?.reminderCompletedAt);if(!sameShared||!explicitReminder)merged.taskPlan.reminderCompletedAt=current.taskPlan?.reminderCompletedAt||'';if(status(current)==='done'&&merged.taskPlan.reminderEnabled&&!merged.taskPlan.reminderCompletedAt)merged.taskPlan.reminderCompletedAt=completion(current)||metadata(current)?.changedAt||at;}}
     if(!current||!equal({...current,status:merged.status,completedAt:merged.completedAt,accountingLink218:merged.accountingLink218},merged))localEdit=true;
     arr.push(merged);
    }
    next[field]=arr;next.accountingExcludedRoots={...(next.accountingExcludedRoots||{}),[field]:[...excluded].filter(Boolean)};
   }
   if(old&&baseline&&equal(proposed.accountingCompletedAt,baseline.accountingCompletedAt))next.accountingCompletedAt=old.accountingCompletedAt||'';
   else if(!equal(next.accountingCompletedAt,old?.accountingCompletedAt)){localEdit=true;if(next.accountingCompletedAt&&(next.accountingMissingDocs||[]).some(x=>status(x)!=='done'))throw new Error('仍有欠缺文件待補，不能標記帳務完成');}
   if(localEdit)unlocked(next,periodMap);
   if(outMap.has(pcId))rows[rows.findIndex(x=>x.id===pcId)]=next;else rows.push(next);outMap.set(pcId,next);
  }
  if(mode==='resolve')for(const resolution of resolutions){const pc=outMap.get(resolution.pcId),field=resolution.field,item=pc?.[field]?.find(x=>x.id===resolution.itemId);if(!pc||!fields.includes(field)||!item||!['done','pending'].includes(resolution.status))throw new Error('請選擇有效的跨期帳務事項與狀態');unlocked(pc,periodMap);const old=oldMap.get(pc.id)?.[field]?.find(x=>x.id===item.id),base=baseMap.get(pc.id)?.[field]?.find(x=>x.id===item.id);if(!old||!base||signature(old)!==signature(base))throw new Error('跨期帳務狀態已變更，請重新載入後再決議');request({pc,field,item},resolution.status,resolution.status==='done'?completion(old):'',true);}
  const groups=index(rows);
  function apply(key,shared,reason){const refs=groups.get(key)||[];for(const {pc,item,field}of refs){const before=JSON.stringify(item);syncItem(item,shared,at);if(before!==JSON.stringify(item)){item.updatedAt=at;pc.updatedAt=at;}if(field==='accountingMissingDocs'&&shared.status==='pending')pc.accountingCompletedAt='';}events.changes.push({key,reason,status:shared.status,completedAt:shared.completedAt,revision:shared.revision,changedPCId:shared.changedPCId,affectedPCIds:[...new Set(refs.map(r=>r.pc.id))]});}
  if(mode==='seed')for(const [key,refs]of groups){
   if(refs.length<2)continue;const duplicate=new Set();if(refs.some(r=>duplicate.has(r.pc.id)||!duplicate.add(r.pc.id))){events.review.push(review(key,refs,'同一期含重複的延續來源',periodMap));continue;}
   const metas=refs.map(r=>({ref:r,meta:metadata(r.item)})).filter(x=>x.meta);
   if(metas.length){const max=Math.max(...metas.map(x=>x.meta.revision)),highest=metas.filter(x=>x.meta.revision===max),canonical=highest[0].meta;
    if(highest.some(x=>!equal(metaSignature(x.meta),metaSignature(canonical))||status(x.ref.item)!==x.meta.status||completion(x.ref.item)!==(x.meta.status==='done'?iso(x.meta.completedAt):''))){events.review.push(review(key,refs,'相同聯動版本的完成狀態互相衝突',periodMap));continue;}
    const ambiguous=refs.some(({pc,item})=>!metadata(item)&&signature(item)!==JSON.stringify([canonical.status,canonical.status==='done'?iso(canonical.completedAt):'',null])&&!untouched(item,pc));
    if(ambiguous){events.review.push(review(key,refs,'舊紀錄曾修改，需確認目前共同狀態',periodMap));continue;}
    if(refs.some(r=>!equal(metaSignature(metadata(r.item)),metaSignature(canonical))||status(r.item)!==canonical.status||completion(r.item)!==(canonical.status==='done'?iso(canonical.completedAt):'')))apply(key,canonical,'reconcile');
    continue;
   }
   const states=new Set(refs.map(r=>JSON.stringify([status(r.item),completion(r.item)])));if(states.size<2)continue;
   const done=refs.filter(r=>status(r.item)==='done'),pending=refs.filter(r=>status(r.item)==='pending');
   if(done.length&&pending.every(r=>untouched(r.item,r.pc))&&new Set(done.map(r=>completion(r.item))).size<=1){const source=done[0],shared={version:1,revision:1,status:'done',completedAt:completion(source.item),changedAt:at,changedPCId:source.pc.id};apply(key,shared,'legacy-seed');}
   else events.review.push(review(key,refs,'舊紀錄的完成狀態或時間不同，請選定共同狀態',periodMap));
  }
  else for(const [key,event]of intents){const {resolve,...shared}=event;apply(key,shared,resolve?'resolve':'edit');}
  for(const pc of rows)if((pc.accountingMissingDocs||[]).some(x=>status(x)!=='done')&&pc.accountingCompletedAt)pc.accountingCompletedAt='';
  return {periodClients:rows,changedIds:rows.filter(pc=>!equal(pc,oldMap.get(pc.id))).map(pc=>pc.id),events};
 }
 return {plan,identity,signature};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createAccountingLinkEngine218};
