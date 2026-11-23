/* The screen list and month share source filters. PDF uses its own export scope. */
const calendarSourceLabels230={note:'手動',case:'案件',contract:'合約',work:'工作',accounting:'帳務',other:'其他'};
function calendarSource230(event){
 const source=event.source||'note';
 if(source==='workAppointment'||source==='workTask')return 'work';
 if(source==='accountingComplete')return 'accounting';
 return Object.hasOwn(calendarSourceLabels230,source)?source:'other';
}
function calendarSourceCounts230(events){
 const counts=new Map();
 for(const event of events){
  const source=calendarSource230(event);
  counts.set(source,(counts.get(source)||0)+1);
 }
 return Object.entries(calendarSourceLabels230).filter(([key])=>counts.has(key))
  .map(([key,label])=>({key,label,count:counts.get(key)}));
}
function calendarGroups230(events){
 const groups=new Map();
 for(const event of events){
  if(!groups.has(event.date))groups.set(event.date,[]);
  groups.get(event.date).push(event);
 }
 return groups;
}
function calendarTimeOrder230(a,b){
 return String(a.time||'99:99').localeCompare(String(b.time||'99:99'))||String(a.id).localeCompare(String(b.id));
}
function renderCalendarMonth(events){
 const [year,month]=state.calendarMonth.split('-').map(Number);
 if(!year||!month)return;
 const first=new Date(year,month-1,1),offset=(first.getDay()+6)%7,groups=calendarGroups230(events),today=localDate();
 const cells=Math.ceil((offset+new Date(year,month,0).getDate())/7)*7;
 const root=$('#calendarGrid'),active=root.contains(document.activeElement)?document.activeElement.dataset.calendarDate:'';
 const week=['一','二','三','四','五','六','日'];
 const days=Array.from({length:cells},(_,index)=>{
  const date=new Date(year,month-1,index+1-offset),key=localDate(date),items=groups.get(key)||[];
  const counts=calendarSourceCounts230(items),summary=counts.map(({label,count})=>label+' '+count).join('、');
  const content=items.length>2
   ?`<span class="calendar-day-summary230">${counts.map(({key,label,count})=>`<span data-event-source230="${key}">${label} <strong>${count}</strong></span>`).join('')}</span>`
   :items.sort(calendarTimeOrder230).map(event=>{
    const client=calendarItemClient(event),title=[client?.name,event.content].filter(Boolean).join(' · ');
    return `<span class="calendar-day-preview230" data-event-source230="${calendarSource230(event)}">${esc(event.time?event.time+' '+title:title)}</span>`;
   }).join('');
  const label=fmtDateWeekday(key)+'，'+items.length+' 筆'+(summary?'，'+summary:'');
  return `<button type="button" class="calendar-day ${date.getMonth()!==month-1?'outside':''} ${key===today?'today':''}" data-calendar-date="${key}" aria-label="${esc(label)}" ${key===today?'aria-current="date"':''}>
   <span class="calendar-date-num">${date.getDate()}${items.length?`<span class="calendar-count211" aria-hidden="true">${items.length}</span>`:''}</span>
   ${content}
  </button>`;
 });
 root.innerHTML=`<div class="calendar-grid">${week.map(day=>`<div class="calendar-weekday">週${day}</div>`).join('')}${days.join('')}</div>`;
 root.querySelectorAll('[data-calendar-date]').forEach(button=>button.onclick=()=>openCalendarDrawer(button.dataset.calendarDate));
 if(active)root.querySelector(`[data-calendar-date="${CSS.escape(active)}"]`)?.focus({preventScroll:true});
}
function calendarScreenRow230(event){
 const details=noteCardHtml(event);
 return `<div class="calendar-row230" data-event-source230="${calendarSource230(event)}">${details}</div>`;
}
function renderCalendarList(events){
 const groups=calendarGroups230(events),ascending=state.calendarSort!=='desc';
 const dates=[...groups.keys()].sort((a,b)=>ascending?a.localeCompare(b):b.localeCompare(a));
 $('#calendarListOrder230').textContent=(ascending?'日期由早到晚':'日期由晚到早')+' · '+events.length+' 筆';
 $('#calendarList').innerHTML=dates.length?dates.map(date=>`<section class="timeline-group">
  <h3 class="timeline-date">${esc(fmtDateWeekday(date))}</h3>
  <div class="timeline-items">${groups.get(date).sort(calendarTimeOrder230).map(calendarScreenRow230).join('')}</div></section>`).join('')
  :'<div class="calendar-empty">沒有符合篩選條件的事件</div>';
 bindCalendarNoteActions();
}
function renderCalendarDay230(date,events=calendarFilteredNotes()){
 const rows=events.filter(event=>event.date===date).sort(calendarTimeOrder230);
 const counts=calendarSourceCounts230(rows).map(({label,count})=>label+' '+count);
 $('#calendarDrawerTitle').textContent=fmtDateWeekday(date);
 $('#calendarDrawerCount').textContent=[rows.length+' 筆',...counts].join(' · ');
 $('#calendarDrawerBody').innerHTML=rows.length?rows.map(calendarScreenRow230).join(''):'<div class="empty">這一天沒有符合篩選條件的事件</div>';
 bindCalendarNoteActions();
}
function openCalendarDrawer(date){
 state.calendarSelectedDate=date;
 const drawer=$('#calendarDrawer'),alreadyOpen=drawer.classList.contains('show');
 renderCalendarDay230(date);
 drawer.classList.add('show');
 drawer.setAttribute('aria-hidden','false');
 if(!alreadyOpen&&state.view==='calendar')$('#calendarDrawerClose').focus({preventScroll:true});
}
function bindCalendarTools230(){
 const menu=$('#calendarTools230');
 const close=()=>{
  menu.open=false;
  $('#calendarMoreBtn').focus({preventScroll:true});
 };
 $('#calMoreHistory').onclick=()=>{close();openCalendarHistory();};
 $('#calMoreClean').onclick=()=>{
  close();
  showModal('清理月份記事',`<label class="field" for="calCleanMonth">清理月份<input class="input" id="calCleanMonth" type="month" value="${esc(state.calendarMonth)}"></label>
   <p class="small muted">清理範圍是所選月份的手動記事。</p>`,
  [{text:'取消',value:false},{text:'繼續',value:true,cls:'danger'}],ok=>{
   const month=$('#calCleanMonth').value;
   if(ok&&month)queueMicrotask(()=>cleanCalendarMonth(month));
  });
 };
 menu.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){event.preventDefault();close();}});
 document.addEventListener('click',event=>{if(menu.open&&!menu.contains(event.target))menu.open=false;});
 $('#calendarDrawerClose').addEventListener('click',()=>{
  if(state.calendarView==='month')$('#calendarGrid').querySelector(`[data-calendar-date="${CSS.escape(state.calendarSelectedDate)}"]`)?.focus({preventScroll:true});
 });
}
