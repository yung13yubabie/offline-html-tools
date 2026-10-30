const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'apps/vat-workbench.html'),'utf8');
const stores=['clients','periods','periodClients','notificationTypes','templates','notifications','calendarNotes','calendarHistory','completed','settings','laws','workTasks'];
let data={},batches=[],fail=false;
const ctx={STORES:stores,BACKUP_VERSION:7,clone:x=>JSON.parse(JSON.stringify(x)),preparedPC210:(x)=>structuredClone(x),getAll:async s=>structuredClone(data[s]||[]),writeBatch210:async ops=>{batches.push(ops);if(fail)throw Error('simulated quota failure');for(const op of ops){data[op.store]??=[];const i=data[op.store].findIndex(x=>x.id===op.value.id);if(i<0)data[op.store].push(op.value);else data[op.store][i]=op.value;}}};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function validateBackup210(b){'),source.indexOf('\nrestoreFile=async function')),ctx);
const backup=(kind='full')=>({backupVersion:7,kind,data:{clients:[{id:'c1',name:'測試'}],periods:[{id:'2026-01'}],periodClients:[{id:'pc1',clientId:'c1',periodId:'2026-01',fees:[],payments:[]}]}});
(async()=>{
 let checks=0;const ok=b=>{ctx.validateBackup210(b);checks++},bad=b=>{assert.throws(()=>ctx.validateBackup210(b));checks++};
 ok(backup());const old=backup();old.backupVersion=1;ok(old);ok({backupVersion:7,kind:'partial',data:{clients:[{id:'客戶-1'}]}});
 for(const id of ['bad"id','bad<id','bad\nid']){const b=backup();b.data.clients[0].id=id;bad(b)}
 for(const version of [0,-1,7.5,8,'no']){const b=backup();b.backupVersion=version;bad(b)}
 for(const field of ['payments','fees','accountingMissingDocs']){const b=backup();b.data.periodClients[0][field]='bad';bad(b)}
 for(const amount of ['oops',{},Infinity]){const b=backup();b.data.periodClients[0].taxAmount=amount;bad(b)}
 {const b=backup();b.data.clients=[];bad(b)}
 {const b=backup();b.data.periods=[];bad(b)}
 {const b=backup();b.data.clients.push({id:'c1'});bad(b)}
 {const b=backup();b.data.clients[0]=JSON.parse('{"id":"c1","__proto__":{}}');bad(b)}
 // Public regression assertion uses only the corrected distributable and synthetic inputs.
 assert(!source.includes('value="${p.id}"'));assert(source.includes('value="${esc(p.id)}"'));checks++;

 data={};batches=[];await ctx.commitBackupMerge211(backup(),new Map());assert.equal(batches.length,1);assert.equal(batches[0].length,3);checks++;
 const addition={backupVersion:7,kind:'partial',data:{clients:[{id:'c2'}]}};fail=true;const before=JSON.stringify(data);await assert.rejects(ctx.commitBackupMerge211(addition,new Map()));assert.equal(JSON.stringify(data),before);checks++;fail=false;
 batches=[];await assert.rejects(ctx.commitBackupMerge211({data:{periodClients:[{id:'bad',clientId:'absent',periodId:'2026-01'}]}},new Map()));assert.equal(batches.length,0);checks++;
 batches=[];await ctx.commitBackupMerge211({data:{clients:[{id:'c1',name:'changed'}]}},new Map());assert.equal(data.clients[0].name,'測試');checks++;
 await ctx.commitBackupMerge211({data:{clients:[{id:'c1',name:'changed'}]}},new Map([['clients:c1','overwrite']]));assert.equal(data.clients[0].name,'changed');checks++;
 console.log(`${checks} VAT backup safety checks passed (mock storage; real IndexedDB browser verification still needed).`);
})().catch(e=>{console.error(e);process.exit(1)});
