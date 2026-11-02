/* Dependency-free number pool: exact small-pool ranking and bounded 100-row search. */
function createNumberPoolEngine() {
  'use strict';
  const SCALE = 10000;
  const MAX_VALUE = 1000000000 * SCALE;
  const limits = Object.freeze({add:100, subtract:100, mixed:100});
  const exactLimits = Object.freeze({add:32, subtract:28, mixed:20});

  function parseNumber(input) {
    let text = String(input ?? '').trim().replace(/[０-９]/g, c => String(c.charCodeAt(0)-0xff10)).replace(/−/g, '-');
    if (!text) throw new Error('請填入數字。');
    if (text.length > 80) throw new Error('數字過長。');
    if (/,/.test(text)) {
      if (!/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d{0,4})?$/.test(text)) throw new Error('千分位格式不正確；請使用 1,234.56。');
      text = text.replace(/,/g, '');
    }
    if (/^[+-]?(?:\d+)?\.\d{5,}$/.test(text)) throw new Error('最多支援小數點後 4 位，請先自行確認要使用的精度。');
    if (!/^[+-]?(?:\d+(?:\.\d{0,4})?|\.\d{1,4})$/.test(text)) throw new Error('請輸入一般十進位數字，可含負號與最多 4 位小數。');
    const negative = text[0] === '-';
    const unsigned = text.replace(/^[+-]/, '');
    const [whole, fraction=''] = unsigned.split('.');
    const value = Number(whole || '0') * SCALE + Number(fraction.padEnd(4, '0'));
    if (!Number.isSafeInteger(value) || value > MAX_VALUE) throw new Error('每個數字與目標的絕對值最多為 1,000,000,000。');
    return value === 0 ? 0 : negative ? -value : value;
  }

  function format(value) {
    if (!Number.isSafeInteger(value)) throw new Error('無法顯示不安全的數值。');
    const abs = Math.abs(value), whole = Math.floor(abs / SCALE);
    const fraction = String(abs % SCALE).padStart(4, '0').replace(/0+$/, '');
    return (value < 0 ? '−' : '') + String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? '.'+fraction : '');
  }

  function parseLines(input, delimiter='') {
    const text = String(input ?? '').replace(/^\uFEFF/, '');
    const separator = delimiter === '\\t' ? '\t' : String(delimiter ?? '');
    const items = [], errors = [];
    if (text.length > 200000) return {items, errors:[{line:0,message:'貼上內容最多 200,000 個字元。'}]};
    if (separator.length > 20 || /[\r\n]/.test(separator)) return {items,errors:[{line:0,message:'分隔符號最多 20 個字元，且不能含換行。'}]};
    const lines = text.split(/\r\n|\n|\r/);
    if (lines.length > 1000) return {items,errors:[{line:0,message:'貼上內容最多 1,000 行。'}]};
    lines.forEach((raw, index) => {
      if (!raw.trim()) return;
      const line = index + 1;
      if (raw.length > 2000) {errors.push({line,message:'每行最多 2,000 個字元。'});return;}
      // A number-only row is valid even when a separator has been selected.
      try {items.push({id:'line-'+line,name:'',value:parseNumber(raw),line});return;} catch (wholeError) {
        if (!separator) {errors.push({line,message:wholeError.message});return;}
      }
      let split = raw.indexOf(separator), found = false;
      let message = '找不到有效的「名稱'+separator+'數字」；請確認分隔符號與右側數字。';
      // The earliest valid numeric suffix preserves delimiters inside names, signs and thousands.
      while (split !== -1) {
        try {
          const value = parseNumber(raw.slice(split + separator.length));
          items.push({id:'line-'+line,name:raw.slice(0,split),value,line});found=true;break;
        } catch (error) {message = error.message;}
        split = raw.indexOf(separator, split + separator.length);
      }
      if (!found) errors.push({line,message});
    });
    return {items,errors};
  }

  function enumerate(values, mode) {
    const zero = [{sum:0,count:0,code:0}], one = [];
    let power = 1;
    values.forEach(value => {
      const length = zero.length, oneLength = one.length;
      if (mode === 'subtract') {
        for (let i=0;i<oneLength;i++) {const s=one[i];one.push({sum:s.sum-value,count:s.count+1,code:s.code+2*power});}
        for (let i=0;i<length;i++) {
          const s=zero[i];
          one.push({sum:s.sum+value,count:s.count+1,code:s.code+power});
          zero.push({sum:s.sum-value,count:s.count+1,code:s.code+2*power});
        }
      } else {
        for (let i=0;i<length;i++) {
          const s=zero[i];
          zero.push({sum:s.sum+value,count:s.count+1,code:s.code+power});
          if (mode==='mixed') zero.push({sum:s.sum-value,count:s.count+1,code:s.code+2*power});
        }
      }
      power *= mode==='add' ? 2 : 3;
    });
    return {zero,one};
  }

  function groupStates(states) {
    states.sort((a,b)=>a.sum-b.sum || a.count-b.count || a.code-b.code);
    const groups=[];
    states.forEach((state,index)=>{
      if (!groups.length || groups[groups.length-1].sum!==state.sum) groups.push({sum:state.sum,start:index,end:index+1});
      else groups[groups.length-1].end=index+1;
    });
    return {states,groups};
  }

  // Large pools use bounded beam search, never an exponential 100-row enumeration.
  // Every row participates in complete single/pair seeding before two opposite-order
  // passes. Four identities per sum and a diverse frontier avoid collapsing names or
  // spending the whole budget on many interchangeable equal-value rows.
  function solveBounded(values, target, mode, tolerance, limit, effort, started) {
    const width = effort === 'deep' ? 3072 : 768;
    const maxStates = effort === 'deep' ? 2200000 : 600000;
    const timeLimit = effort === 'deep' ? 6000 : 1800;
    const powers = values.map((_,i)=>1n << BigInt(i*2));
    const capacity = limit+1, best = [], known = new Set();
    let examined = 0, stopped = '', nextClockCheck = 256;
    const distance = state=>Math.abs(state.sum-target);
    const compare = (a,b)=>distance(a)-distance(b) || a.count-b.count || (a.code<b.code?-1:a.code>b.code?1:0);
    function accept(state) {
      if (!state.count || (mode==='subtract' && !state.anchor) || distance(state)>tolerance || known.has(state.code)) return;
      if (best.length===capacity && compare(state,best[best.length-1])>=0) return;
      let low=0,high=best.length;
      while(low<high){const middle=(low+high)>>1;if(compare(best[middle],state)<0)low=middle+1;else high=middle;}
      best.splice(low,0,state);known.add(state.code);
      if(best.length>capacity)known.delete(best.pop().code);
    }
    function exhausted() {
      if(examined>=maxStates){stopped='state-budget';return true;}
      if(examined>=nextClockCheck){nextClockCheck=examined+256;if(Date.now()-started>=timeLimit){stopped='time-budget';return true;}}
      return false;
    }
    // At most 20,000 cheap seeds for 100 rows: no prefix-only truncation.
    for(let i=0;i<values.length;i++){
      accept({sum:values[i],count:1,code:powers[i],anchor:true});examined++;
      if(mode==='mixed'){accept({sum:-values[i],count:1,code:powers[i]<<1n,anchor:false});examined++;}
      for(let j=0;j<i;j++){
        if(mode!=='subtract'){accept({sum:values[j]+values[i],count:2,code:powers[j]|powers[i],anchor:true});examined++;}
        if(mode!=='add'){
          accept({sum:values[j]-values[i],count:2,code:powers[j]|(powers[i]<<1n),anchor:true});
          accept({sum:-values[j]+values[i],count:2,code:(powers[j]<<1n)|powers[i],anchor:true});examined+=2;
          if(mode==='mixed'){accept({sum:-values[j]-values[i],count:2,code:(powers[j]|powers[i])<<1n,anchor:false});examined++;}
        }
      }
    }
    function retain(candidates, step) {
      candidates.sort(compare);
      const counts=new Map(),diverse=[];
      for(const state of candidates){
        const key=state.sum+':'+Number(mode==='subtract'&&state.anchor),count=counts.get(key)||0;
        if(count<4){counts.set(key,count+1);diverse.push(state);}
      }
      if(diverse.length<=width)return diverse;
      const chosen=[],codes=new Set();
      const take=state=>{if(!codes.has(state.code)&&chosen.length<width){codes.add(state.code);chosen.push(state);}};
      // Keep the target-nearest states, partial progress, and spread-out sums. The
      // latter two protect paths that need many inputs or later opposite signs.
      for(let i=0;i<Math.floor(width/2);i++)take(diverse[i]);
      const progress=target*step/values.length;
      diverse.sort((a,b)=>Math.abs(a.sum-progress)-Math.abs(b.sum-progress)||compare(a,b));
      for(let i=0;i<Math.floor(width/4);i++)take(diverse[i]);
      diverse.sort((a,b)=>a.sum-b.sum||compare(a,b));
      const spread=Math.floor(width/4);
      for(let i=0;i<spread;i++)take(diverse[Math.floor(i*(diverse.length-1)/Math.max(1,spread-1))]);
      for(const state of diverse){take(state);if(chosen.length===width)break;}
      return chosen;
    }
    const natural=values.map((_,i)=>i);
    for(const order of [natural,[...natural].reverse()]){
      if(exhausted())break;
      const remainingMin=Array(values.length+1).fill(0),remainingMax=Array(values.length+1).fill(0),remainingAbs=Array(values.length+1).fill(0);
      for(let p=values.length-1;p>=0;p--){const value=values[order[p]];remainingMin[p]=remainingMin[p+1]+Math.min(0,value);remainingMax[p]=remainingMax[p+1]+Math.max(0,value);remainingAbs[p]=remainingAbs[p+1]+Math.abs(value);}
      let frontier=[{sum:0,count:0,code:0n,anchor:false}];
      for(let position=0;position<order.length;position++){
        if(exhausted())break;
        const index=order[position],value=values[index],next=position+1,candidates=[];
        function consider(state){
          examined++;accept(state);
          let low,high;
          if(mode==='add'){low=remainingMin[next];high=remainingMax[next];}
          else if(mode==='subtract'&&state.anchor){low=-remainingMax[next];high=-remainingMin[next];}
          else {low=-remainingAbs[next];high=remainingAbs[next];}
          if(state.sum+high<target-tolerance||state.sum+low>target+tolerance)return;
          candidates.push(state);
        }
        for(const state of frontier){
          if(exhausted())break;
          consider(state);
          if(mode!=='subtract'||!state.anchor)consider({sum:state.sum+value,count:state.count+1,code:state.code|powers[index],anchor:true});
          if(mode!=='add')consider({sum:state.sum-value,count:state.count+1,code:state.code|(powers[index]<<1n),anchor:state.anchor});
        }
        if(stopped)break;
        // Always keep the empty prefix so late input rows can start a new path.
        frontier=retain(candidates,next);
        if(!frontier.some(state=>!state.count))frontier.push({sum:0,count:0,code:0n,anchor:false});
      }
      if(stopped)break;
    }
    const solutions=best.slice(0,limit).map(state=>{
      const terms=[];
      for(let index=0;index<values.length;index++){const digit=Number((state.code>>BigInt(index*2))&3n);if(digit)terms.push({index,sign:digit===1?1:-1});}
      return {terms,total:state.sum||0,difference:(state.sum-target)||0};
    });
    return {solutions,truncated:best.length>limit,complete:false,totalMatches:null,limit,mode,tolerance,examined,poolSize:values.length,
      strategy:'bounded',searchComplete:false,rankingGuaranteed:false,stopReason:stopped||'bounded-search',effort,elapsedMs:Math.max(0,Date.now()-started)};
  }

  function solve(options) {
    if (!options || !Array.isArray(options.items)) throw new Error('請提供數字清單。');
    const started=Date.now();
    const {items,target,mode='add',tolerance=Infinity,limit=100,effort='standard'} = options;
    if (!['standard','deep'].includes(effort)) throw new Error('請選擇標準或加強搜尋。');
    if (!Object.hasOwn(limits,mode)) throw new Error('請選擇加法、減法或加減混合模式。');
    if (!items.length) throw new Error('請先加入至少一筆數字。');
    if (items.length > limits[mode]) throw new Error((mode==='add'?'加法':mode==='subtract'?'減法':'加減混合')+'模式最多 '+limits[mode]+' 筆；請先縮小數字池。');
    if (!Number.isSafeInteger(target) || Math.abs(target)>MAX_VALUE) throw new Error('目標數字超出範圍或精度不正確。');
    if (tolerance!==Infinity && (!Number.isSafeInteger(tolerance) || tolerance<0 || tolerance>MAX_VALUE)) throw new Error('容許差額須為 0 至 1,000,000,000；空白可搜尋所有差額。');
    if (!Number.isInteger(limit) || limit<1 || limit>1000) throw new Error('顯示上限須為 1 至 1,000 組。');
    const values=items.map((item,index)=>{
      if (!item || !Number.isSafeInteger(item.value) || Math.abs(item.value)>MAX_VALUE) throw new Error('第 '+(index+1)+' 筆數字超出範圍或精度不正確。');
      return item.value;
    });
    if(values.length>exactLimits[mode])return solveBounded(values,target,mode,tolerance,limit,effort,started);
    const split=Math.floor(values.length/2), base=mode==='add'?2:3, factor=base**split;
    const left=enumerate(values.slice(0,split),mode),right=enumerate(values.slice(split),mode);
    const streams=mode==='subtract' ? [[left.zero,groupStates(right.one)],[left.one,groupStates(right.zero)]] : [[left.zero,groupStates(right.zero)]];
    const heap=[];
    function compare(a,b){return a.distance-b.distance || a.count-b.count || a.code-b.code;}
    function push(node){let i=heap.length;heap.push(node);while(i){const p=(i-1)>>1;if(compare(heap[p],node)<=0)break;heap[i]=heap[p];i=p;}heap[i]=node;}
    function pop(){const root=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&compare(heap[c+1],heap[c])<0)c++;if(compare(last,heap[c])<=0)break;heap[i]=heap[c];i=c;}heap[i]=last;}return root;}
    function candidate(s, g, direction, member) {
      const group=s.right.groups[g];if(!group)return;
      const r=s.right.states[member ?? group.start],total=s.left.sum+r.sum,distance=Math.abs(total-target);
      if (distance>tolerance)return;
      push({stream:s,group:g,direction,member:member ?? group.start,total,distance,count:s.left.count+r.count,code:s.left.code+r.code*factor});
    }
    streams.forEach(([states,rightData])=>states.forEach(l=>{
      if(!rightData.groups.length)return;
      let low=0,high=rightData.groups.length;const wanted=target-l.sum;
      while(low<high){const middle=(low+high)>>1;if(rightData.groups[middle].sum<wanted)low=middle+1;else high=middle;}
      const stream={left:l,right:rightData};candidate(stream,low,1);candidate(stream,low-1,-1);
    }));
    const solutions=[];let examined=0,truncated=false;
    while(heap.length){
      const n=pop(),g=n.stream.right.groups[n.group];examined++;
      if(n.member===g.start)candidate(n.stream,n.group+n.direction,n.direction);
      if(n.member+1<g.end)candidate(n.stream,n.group,n.direction,n.member+1);
      if(n.count===0)continue;
      if(solutions.length===limit){truncated=true;break;}
      const terms=[];let code=n.code;
      for(let index=0;index<values.length;index++){const digit=code%base;code=Math.floor(code/base);if(digit)terms.push({index,sign:digit===1?1:-1});}
      solutions.push({terms,total:n.total,difference:n.total-target});
    }
    return {solutions,truncated,complete:!truncated,totalMatches:truncated?null:solutions.length,limit,mode,tolerance,examined,poolSize:items.length,
      strategy:'exact',searchComplete:true,rankingGuaranteed:true,stopReason:truncated?'display-limit':'complete',effort,elapsedMs:Math.max(0,Date.now()-started)};
  }
  return Object.freeze({SCALE,MAX_VALUE,limits,exactLimits,parseNumber,parseLines,format,solve});
}
const NumberPoolEngine = createNumberPoolEngine();
if (typeof module !== 'undefined' && module.exports) module.exports = {createNumberPoolEngine,NumberPoolEngine};
